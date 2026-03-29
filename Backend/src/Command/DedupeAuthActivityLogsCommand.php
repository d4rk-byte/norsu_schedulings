<?php

namespace App\Command;

use App\Entity\ActivityLog;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:dedupe-auth-activity-logs',
    description: 'Remove duplicate user.login/user.logout activity log entries created within a short time window.',
)]
class DedupeAuthActivityLogsCommand extends Command
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('apply', null, InputOption::VALUE_NONE, 'Actually delete duplicate records (default is dry-run).')
            ->addOption('window', null, InputOption::VALUE_REQUIRED, 'Duplicate time window in seconds.', '5');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $apply = (bool) $input->getOption('apply');
        $windowSeconds = max(1, (int) $input->getOption('window'));

        $io->title('Deduplicate Auth Activity Logs');
        $io->text(sprintf('Mode: %s', $apply ? 'APPLY' : 'DRY-RUN'));
        $io->text(sprintf('Window: %d second(s)', $windowSeconds));

        $logs = $this->entityManager->createQueryBuilder()
            ->select('a', 'u')
            ->from(ActivityLog::class, 'a')
            ->leftJoin('a.user', 'u')
            ->where('a.user IS NOT NULL')
            ->andWhere('a.action IN (:actions)')
            ->setParameter('actions', ['user.login', 'user.logout'])
            ->orderBy('a.createdAt', 'ASC')
            ->addOrderBy('a.id', 'ASC')
            ->getQuery()
            ->getResult();

        $io->text(sprintf('Scanned %d auth activity record(s).', count($logs)));

        $lastSeenByKey = [];
        $duplicateIds = [];
        $duplicateByAction = [
            'user.login' => 0,
            'user.logout' => 0,
        ];

        foreach ($logs as $log) {
            if (!$log instanceof ActivityLog) {
                continue;
            }

            $user = $log->getUser();
            if ($user === null) {
                continue;
            }

            $action = (string) $log->getAction();
            $description = (string) ($log->getDescription() ?? '');
            $ipAddress = (string) ($log->getIpAddress() ?? '');
            $userAgent = (string) ($log->getUserAgent() ?? '');
            $createdAt = $log->getCreatedAt();
            if ($createdAt === null) {
                continue;
            }

            $key = implode('|', [
                (string) $user->getId(),
                $action,
                $description,
                $ipAddress,
                $userAgent,
            ]);

            if (isset($lastSeenByKey[$key])) {
                /** @var \DateTimeImmutable $lastCreated */
                $lastCreated = $lastSeenByKey[$key];
                $deltaSeconds = $createdAt->getTimestamp() - $lastCreated->getTimestamp();

                if ($deltaSeconds >= 0 && $deltaSeconds <= $windowSeconds) {
                    $id = $log->getId();
                    if ($id !== null) {
                        $duplicateIds[] = $id;
                        if (isset($duplicateByAction[$action])) {
                            $duplicateByAction[$action]++;
                        }
                    }

                    continue;
                }
            }

            $lastSeenByKey[$key] = $createdAt;
        }

        $totalDuplicates = count($duplicateIds);

        if ($totalDuplicates === 0) {
            $io->success('No duplicate auth activity logs found.');
            return Command::SUCCESS;
        }

        $io->section('Duplicate Summary');
        $io->listing([
            sprintf('Total duplicates: %d', $totalDuplicates),
            sprintf('user.login duplicates: %d', $duplicateByAction['user.login']),
            sprintf('user.logout duplicates: %d', $duplicateByAction['user.logout']),
        ]);

        if (!$apply) {
            $io->warning('Dry-run only. Re-run with --apply to delete duplicates.');
            return Command::SUCCESS;
        }

        $connection = $this->entityManager->getConnection();

        foreach (array_chunk($duplicateIds, 500) as $chunk) {
            $connection->executeStatement(
                'DELETE FROM activity_logs WHERE id IN (?)',
                [$chunk],
                [ArrayParameterType::INTEGER]
            );
        }

        $io->success(sprintf('Deleted %d duplicate auth activity log record(s).', $totalDuplicates));

        return Command::SUCCESS;
    }
}
