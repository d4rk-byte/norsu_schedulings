<?php

namespace App\Command;

use App\Service\SystemSettingsService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:set-semester',
    description: 'Set the active semester for the system',
)]
class SetSemesterCommand extends Command
{
    public function __construct(
        private SystemSettingsService $systemSettingsService
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('semester', InputArgument::REQUIRED, 'Semester to set (1st, 2nd, or Summer)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $semester = $input->getArgument('semester');

        $io->title('Setting Active Semester');

        // Show current state
        $io->section('Current State');
        $current = $this->systemSettingsService->getActiveSemesterDisplay();
        $io->info('Current: ' . $current);

        // Try to change semester
        $io->section('Changing Semester');
        $io->writeln('Setting semester to: ' . $semester);

        try {
            $result = $this->systemSettingsService->changeActiveSemester($semester);
            $io->success('Successfully changed semester!');
            $io->writeln('New: ' . $result->getFullDisplayName());
        } catch (\Exception $e) {
            $io->error('Failed to change semester: ' . $e->getMessage());
            return Command::FAILURE;
        }

        // Verify
        $io->section('Verification');
        $new = $this->systemSettingsService->getActiveSemesterDisplay();
        $io->success('Active semester: ' . $new);

        return Command::SUCCESS;
    }
}
