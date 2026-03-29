<?php

namespace App\Command;

use App\Repository\SubjectRepository;
use App\Repository\DepartmentRepository;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Console\Helper\Table;

#[AsCommand(
    name: 'app:validate-subject-departments',
    description: 'Validate that all subjects belong to existing departments',
)]
class ValidateSubjectDepartmentsCommand extends Command
{
    public function __construct(
        private SubjectRepository $subjectRepository,
        private DepartmentRepository $departmentRepository
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $io->title('Subject Department Validation');

        // Get all subjects
        $subjects = $this->subjectRepository->findAll();
        $departments = $this->departmentRepository->findAll();

        $io->info(sprintf('Total subjects: %d', count($subjects)));
        $io->info(sprintf('Total departments: %d', count($departments)));

        // Group subjects by department
        $subjectsByDepartment = [];
        $orphanedSubjects = [];

        foreach ($subjects as $subject) {
            $dept = $subject->getDepartment();
            if ($dept) {
                $deptId = $dept->getId();
                if (!isset($subjectsByDepartment[$deptId])) {
                    $subjectsByDepartment[$deptId] = [
                        'name' => $dept->getName(),
                        'code' => $dept->getCode(),
                        'count' => 0
                    ];
                }
                $subjectsByDepartment[$deptId]['count']++;
            } else {
                $orphanedSubjects[] = [
                    'id' => $subject->getId(),
                    'code' => $subject->getCode(),
                    'title' => $subject->getTitle()
                ];
            }
        }

        // Display distribution
        $io->section('Subjects Distribution by Department');

        $table = new Table($output);
        $table->setHeaders(['Department Code', 'Department Name', 'Subject Count']);

        foreach ($subjectsByDepartment as $data) {
            $table->addRow([$data['code'], $data['name'], $data['count']]);
        }

        $table->render();

        // Show orphaned subjects if any
        if (!empty($orphanedSubjects)) {
            $io->warning(sprintf('Found %d orphaned subjects without valid department!', count($orphanedSubjects)));
            
            $orphanTable = new Table($output);
            $orphanTable->setHeaders(['ID', 'Code', 'Title']);
            
            foreach ($orphanedSubjects as $subject) {
                $orphanTable->addRow([$subject['id'], $subject['code'], $subject['title']]);
            }
            
            $orphanTable->render();
            
            $io->error('Please assign these subjects to valid departments!');
            return Command::FAILURE;
        }

        $io->success('All subjects are properly assigned to existing departments!');
        
        return Command::SUCCESS;
    }
}
