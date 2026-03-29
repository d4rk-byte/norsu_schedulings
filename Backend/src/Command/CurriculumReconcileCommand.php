<?php

namespace App\Command;

use App\Entity\Curriculum;
use App\Entity\CurriculumTerm;
use App\Entity\Subject;
use App\Repository\CurriculumRepository;
use App\Repository\CurriculumTermRepository;
use App\Repository\CurriculumSubjectRepository;
use App\Repository\SubjectRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Command\Command;

#[AsCommand(name: 'app:curriculum:reconcile', description: 'Reconcile curriculum terms and subjects after upload')]
class CurriculumReconcileCommand extends Command
{
    public function __construct(
        private CurriculumRepository $curriculumRepository,
        private CurriculumTermRepository $curriculumTermRepository,
        private SubjectRepository $subjectRepository,
        private CurriculumSubjectRepository $curriculumSubjectRepository,
        private EntityManagerInterface $em
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('curriculum-id', InputArgument::REQUIRED, 'Curriculum ID to reconcile')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Do not modify the database, only show actions')
            ->setHelp('This command shows curriculum statistics and unlinked subjects. Use CSV upload for proper term/subject assignment.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $curriculumId = (int)$input->getArgument('curriculum-id');
        $dryRun = (bool)$input->getOption('dry-run');

        $curriculum = $this->curriculumRepository->find($curriculumId);
        if (!$curriculum) {
            $output->writeln("<error>Curriculum ID {$curriculumId} not found.</error>");
            return Command::FAILURE;
        }

        $output->writeln("=== Curriculum Report ===");
        $output->writeln("Curriculum: {$curriculum->getName()} (ID: {$curriculumId})");
        $output->writeln("Department: {$curriculum->getDepartment()->getName()}");
        $output->writeln("");

        // Check existing terms
        $existingTerms = $this->curriculumTermRepository->findByCurriculum($curriculumId);
        $output->writeln("Existing terms: " . count($existingTerms));
        
        if (count($existingTerms) > 0) {
            foreach ($existingTerms as $term) {
                $subjectCount = count($term->getCurriculumSubjects());
                $output->writeln("  - {$term->getTermName()}: {$subjectCount} subjects");
            }
        } else {
            $output->writeln("<comment>No terms found. Please upload a curriculum CSV to create terms automatically.</comment>");
        }
        
        $output->writeln("");

        // List unlinked subjects for this curriculum's department
        $departmentId = $curriculum->getDepartmentId();
        $qb = $this->subjectRepository->createQueryBuilder('s')
            ->leftJoin('App\Entity\CurriculumSubject', 'cs', 'WITH', 'cs.subject = s')
            ->leftJoin('cs.curriculumTerm', 'ct', 'WITH', 'ct.curriculum = :curr')
            ->andWhere('s.departmentId = :dept')
            ->andWhere('cs.id IS NULL')
            ->setParameter('dept', $departmentId)
            ->setParameter('curr', $curriculumId)
            ->orderBy('s.code', 'ASC');

        $unlinkedSubjects = $qb->getQuery()->getResult();

        $output->writeln("Unlinked subjects in department: " . count($unlinkedSubjects));
        
        if (count($unlinkedSubjects) > 0) {
            $output->writeln("<comment>The following subjects are not assigned to any term:</comment>");
            foreach ($unlinkedSubjects as $subject) {
                $output->writeln("  - {$subject->getCode()}: {$subject->getTitle()}");
            }
            $output->writeln("");
            $output->writeln("<info>To assign these subjects, please:</info>");
            $output->writeln("  1. Upload a complete curriculum CSV with year_level and semester columns");
            $output->writeln("  2. Or manually add subjects through the admin interface");
        } else {
            $output->writeln("<info>All subjects are properly assigned!</info>");
        }

        $output->writeln("");
        $output->writeln("Done.");
        return Command::SUCCESS;
    }

    private function getOrdinalSuffix(int $n): string
    {
        if (!in_array(($n % 100), [11,12,13])) {
            switch ($n % 10) {
                case 1: return 'st';
                case 2: return 'nd';
                case 3: return 'rd';
            }
        }
        return 'th';
    }

    private function niceSemester(string $s): string
    {
        return match(strtolower($s)) {
            '1st' => '1st Semester',
            '2nd' => '2nd Semester',
            'summer' => 'Summer',
            default => ucfirst($s)
        };
    }
}
