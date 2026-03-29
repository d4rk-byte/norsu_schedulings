<?php

namespace App\Repository;

use App\Entity\ScheduleChangeRequest;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ScheduleChangeRequest>
 */
class ScheduleChangeRequestRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ScheduleChangeRequest::class);
    }

    public function save(ScheduleChangeRequest $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(ScheduleChangeRequest $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * @return ScheduleChangeRequest[]
     */
    public function findByRequester(User $requester, ?string $status = null, int $limit = 100): array
    {
        $qb = $this->createQueryBuilder('scr')
            ->leftJoin('scr.schedule', 's')->addSelect('s')
            ->leftJoin('s.subject', 'sub')->addSelect('sub')
            ->leftJoin('s.room', 'r')->addSelect('r')
            ->leftJoin('scr.proposedRoom', 'pr')->addSelect('pr')
            ->leftJoin('scr.subjectDepartment', 'dept')->addSelect('dept')
            ->leftJoin('scr.adminApprover', 'adminApprover')->addSelect('adminApprover')
            ->leftJoin('scr.departmentHeadApprover', 'dhApprover')->addSelect('dhApprover')
            ->leftJoin('scr.adminReviewer', 'adminReviewer')->addSelect('adminReviewer')
            ->leftJoin('scr.departmentHeadReviewer', 'dhReviewer')->addSelect('dhReviewer')
            ->where('scr.requester = :requester')
            ->setParameter('requester', $requester)
            ->orderBy('scr.submittedAt', 'DESC')
            ->setMaxResults($limit);

        if ($status !== null && $status !== '') {
            $qb->andWhere('scr.status = :status')
                ->setParameter('status', $status);
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * @return ScheduleChangeRequest[]
     */
    public function findForAdmin(?string $status = null, ?string $adminStatus = null, int $limit = 100): array
    {
        $qb = $this->createQueryBuilder('scr')
            ->leftJoin('scr.schedule', 's')->addSelect('s')
            ->leftJoin('s.subject', 'sub')->addSelect('sub')
            ->leftJoin('s.room', 'r')->addSelect('r')
            ->leftJoin('s.faculty', 'f')->addSelect('f')
            ->leftJoin('scr.requester', 'requester')->addSelect('requester')
            ->leftJoin('scr.proposedRoom', 'pr')->addSelect('pr')
            ->leftJoin('scr.subjectDepartment', 'dept')->addSelect('dept')
            ->leftJoin('scr.adminApprover', 'adminApprover')->addSelect('adminApprover')
            ->leftJoin('scr.departmentHeadApprover', 'dhApprover')->addSelect('dhApprover')
            ->leftJoin('scr.adminReviewer', 'adminReviewer')->addSelect('adminReviewer')
            ->leftJoin('scr.departmentHeadReviewer', 'dhReviewer')->addSelect('dhReviewer')
            ->orderBy('scr.submittedAt', 'DESC')
            ->setMaxResults($limit);

        if ($status !== null && $status !== '' && $status !== 'all') {
            $qb->andWhere('scr.status = :status')
                ->setParameter('status', $status);
        }

        if ($adminStatus !== null && $adminStatus !== '' && $adminStatus !== 'all') {
            $qb->andWhere('scr.adminStatus = :adminStatus')
                ->setParameter('adminStatus', $adminStatus);
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * @return ScheduleChangeRequest[]
     */
    public function findForDepartmentHead(User $departmentHead, ?int $requesterDepartmentId = null, ?string $status = null, ?string $departmentHeadStatus = null, int $limit = 100): array
    {
        $qb = $this->createQueryBuilder('scr')
            ->leftJoin('scr.schedule', 's')->addSelect('s')
            ->leftJoin('s.subject', 'sub')->addSelect('sub')
            ->leftJoin('sub.department', 'subDept')->addSelect('subDept')
            ->leftJoin('s.room', 'r')->addSelect('r')
            ->leftJoin('s.faculty', 'f')->addSelect('f')
            ->leftJoin('scr.requester', 'requester')->addSelect('requester')
            ->leftJoin('requester.department', 'requesterDept')->addSelect('requesterDept')
            ->leftJoin('scr.proposedRoom', 'pr')->addSelect('pr')
            ->leftJoin('scr.subjectDepartment', 'dept')->addSelect('dept')
            ->leftJoin('scr.adminApprover', 'adminApprover')->addSelect('adminApprover')
            ->leftJoin('scr.departmentHeadApprover', 'dhApprover')->addSelect('dhApprover')
            ->leftJoin('scr.adminReviewer', 'adminReviewer')->addSelect('adminReviewer')
            ->leftJoin('scr.departmentHeadReviewer', 'dhReviewer')->addSelect('dhReviewer')
            ->orderBy('scr.submittedAt', 'DESC')
            ->setMaxResults($limit);

        if ($requesterDepartmentId !== null) {
            $qb
                ->andWhere('requesterDept.id = :requesterDepartmentId')
                ->setParameter('requesterDepartmentId', $requesterDepartmentId);
        } else {
            $qb
                ->andWhere('scr.departmentHeadApprover = :departmentHead')
                ->setParameter('departmentHead', $departmentHead);
        }

        if ($departmentHeadStatus !== null && $departmentHeadStatus !== '' && $departmentHeadStatus !== 'all') {
            if ($departmentHeadStatus === ScheduleChangeRequest::APPROVAL_APPROVED) {
                $qb
                    ->andWhere('(scr.departmentHeadStatus = :departmentHeadStatus OR scr.status = :approvedStatus)')
                    ->setParameter('departmentHeadStatus', $departmentHeadStatus)
                    ->setParameter('approvedStatus', ScheduleChangeRequest::STATUS_APPROVED);
            } else {
                $qb->andWhere('scr.departmentHeadStatus = :departmentHeadStatus')
                    ->setParameter('departmentHeadStatus', $departmentHeadStatus);
            }
        }

        if ($status !== null && $status !== '' && $status !== 'all') {
            $qb->andWhere('scr.status = :status')
                ->setParameter('status', $status);
        }

        return $qb->getQuery()->getResult();
    }
}