<?php

namespace App\Command;

use App\Repository\DepartmentRepository;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:validate-department-colleges',
    description: 'Validates that all active departments have a college assigned',
)]
class ValidateDepartmentCollegesCommand extends Command
{
    private DepartmentRepository $departmentRepository;

    public function __construct(DepartmentRepository $departmentRepository)
    {
        parent::__construct();
        $this->departmentRepository = $departmentRepository;
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        
        $io->title('Department-College Validation Report');
        
        // Get all active departments
        $departments = $this->departmentRepository->findBy(['isActive' => true]);
        
        $orphanedDepartments = [];
        $validDepartments = [];
        $departmentsByCollege = [];
        
        foreach ($departments as $department) {
            if ($department->getCollege() === null) {
                $orphanedDepartments[] = [
                    'ID' => $department->getId(),
                    'Code' => $department->getCode(),
                    'Name' => $department->getName(),
                ];
            } else {
                $validDepartments[] = $department;
                $collegeName = $department->getCollege()->getName();
                if (!isset($departmentsByCollege[$collegeName])) {
                    $departmentsByCollege[$collegeName] = [];
                }
                $departmentsByCollege[$collegeName][] = [
                    'Code' => $department->getCode(),
                    'Name' => $department->getName(),
                ];
            }
        }
        
        // Display statistics
        $io->section('Statistics');
        $io->table(
            ['Metric', 'Count'],
            [
                ['Total Active Departments', count($departments)],
                ['Valid Departments (with College)', count($validDepartments)],
                ['Orphaned Departments (no College)', count($orphanedDepartments)],
            ]
        );
        
        // Display orphaned departments if any
        if (!empty($orphanedDepartments)) {
            $io->section('⚠️  Orphaned Departments (No College Assigned)');
            $io->warning('These departments are active but have no college assigned. They will not appear in the registration form.');
            $io->table(
                ['ID', 'Code', 'Name'],
                $orphanedDepartments
            );
        } else {
            $io->success('All active departments have a college assigned! ✓');
        }
        
        // Display departments grouped by college
        if (!empty($departmentsByCollege)) {
            $io->section('Departments by College');
            foreach ($departmentsByCollege as $collegeName => $depts) {
                $io->writeln(sprintf('<info>%s</info> (%d departments)', $collegeName, count($depts)));
                foreach ($depts as $dept) {
                    $io->writeln(sprintf('  • [%s] %s', $dept['Code'], $dept['Name']));
                }
                $io->newLine();
            }
        }
        
        return Command::SUCCESS;
    }
}
