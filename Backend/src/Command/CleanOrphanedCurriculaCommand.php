<?php

namespace App\Command;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:clean-orphaned-curricula',
    description: 'Clean up curricula that have no associated department',
)]
class CleanOrphanedCurriculaCommand extends Command
{
    public function __construct(
        private EntityManagerInterface $entityManager
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $io->title('Cleaning Orphaned Curricula');

        // Find all curricula with null or non-existent departments
        $connection = $this->entityManager->getConnection();
        
        $sql = '
            SELECT c.id, c.name 
            FROM curricula c 
            LEFT JOIN departments d ON c.department_id = d.id 
            WHERE d.id IS NULL
        ';
        
        $stmt = $connection->prepare($sql);
        $result = $stmt->executeQuery();
        $orphanedCurricula = $result->fetchAllAssociative();

        if (empty($orphanedCurricula)) {
            $io->success('No orphaned curricula found!');
            return Command::SUCCESS;
        }

        $io->warning(sprintf('Found %d orphaned curricula:', count($orphanedCurricula)));
        
        foreach ($orphanedCurricula as $curriculum) {
            $io->writeln(sprintf('  - ID %s: %s', $curriculum['id'], $curriculum['name']));
        }

        if (!$io->confirm('Do you want to delete these orphaned curricula?', false)) {
            $io->note('Operation cancelled.');
            return Command::SUCCESS;
        }

        // Delete orphaned curricula
        $deleteSql = '
            DELETE FROM curricula 
            WHERE id IN (
                SELECT c.id 
                FROM curricula c 
                LEFT JOIN departments d ON c.department_id = d.id 
                WHERE d.id IS NULL
            )
        ';
        
        $deleteStmt = $connection->prepare($deleteSql);
        $deleteStmt->executeStatement();

        $io->success(sprintf('Successfully deleted %d orphaned curricula!', count($orphanedCurricula)));

        return Command::SUCCESS;
    }
}
