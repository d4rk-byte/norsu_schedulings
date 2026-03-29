<?php

namespace App\Service;

use App\Entity\Subject;
use App\Repository\SubjectRepository;
use Doctrine\ORM\EntityManagerInterface;

class SubjectService
{
    private SubjectRepository $subjectRepository;
    private EntityManagerInterface $entityManager;

    public function __construct(
        SubjectRepository $subjectRepository,
        EntityManagerInterface $entityManager
    ) {
        $this->subjectRepository = $subjectRepository;
        $this->entityManager = $entityManager;
    }

    /**
     * Get all subjects with optional filtering
     */
    public function getSubjects(array $filters = []): array
    {
        $qb = $this->subjectRepository->createQueryBuilder('s')
            ->where('s.deletedAt IS NULL');

        // Filter by semester if provided
        $semesterJoinAdded = false;
        $curriculumJoinAdded = false;
        
        if (!empty($filters['semester'])) {
            $qb->innerJoin('App\Entity\CurriculumSubject', 'cs', 'WITH', 'cs.subject = s.id')
               ->innerJoin('cs.curriculumTerm', 'ct')
               ->innerJoin('ct.curriculum', 'c')
               ->andWhere('ct.semester = :semester')
               ->setParameter('semester', $filters['semester'])
               ->groupBy('s.id');
            $semesterJoinAdded = true;
            $curriculumJoinAdded = true;
        }

        // Filter by published curricula only if requested
        if (!empty($filters['published_only'])) {
            if (!$semesterJoinAdded) {
                $qb->innerJoin('App\Entity\CurriculumSubject', 'cs', 'WITH', 'cs.subject = s.id');
                $semesterJoinAdded = true;
            }
            if (!$curriculumJoinAdded) {
                $qb->innerJoin('cs.curriculumTerm', 'ct');
                $qb->innerJoin('ct.curriculum', 'c');
                $curriculumJoinAdded = true;
            }
            $qb->andWhere('c.isPublished = :published')
               ->setParameter('published', true);
            if (!$semesterJoinAdded) {
                $qb->groupBy('s.id');
            }
        }

        // Apply filters
        if (!empty($filters['search'])) {
            $qb->andWhere('s.code LIKE :search OR s.title LIKE :search')
               ->setParameter('search', '%' . $filters['search'] . '%');
        }

        if (isset($filters['department_id']) && $filters['department_id'] !== '') {
            // Include subjects that either:
            // 1. Belong to the department directly, OR
            // 2. Are part of curricula in this department (includes GE/shared subjects)
            if (!$semesterJoinAdded) {
                $qb->leftJoin('App\Entity\CurriculumSubject', 'cs', 'WITH', 'cs.subject = s.id');
                $semesterJoinAdded = true;
            }
            if (!$curriculumJoinAdded) {
                $qb->leftJoin('cs.curriculumTerm', 'ct');
                $qb->leftJoin('ct.curriculum', 'c');
                $curriculumJoinAdded = true;
            }
            
            $qb->andWhere(
                $qb->expr()->orX(
                    's.department = :departmentId',
                    'c.department = :departmentId'
                )
            )
            ->setParameter('departmentId', $filters['department_id'])
            ->groupBy('s.id');
        }

        if (isset($filters['type']) && $filters['type'] !== '') {
            $qb->andWhere('s.type = :type')
               ->setParameter('type', $filters['type']);
        }

        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $qb->andWhere('s.isActive = :active')
               ->setParameter('active', (bool)$filters['is_active']);
        }

        // Sorting (allow-list for safety)
        $allowedSortFields = [
            'id' => 's.id',
            'code' => 's.code',
            'title' => 's.title',
            'units' => 's.units',
            'type' => 's.type',
            'yearLevel' => 's.yearLevel',
            'semester' => 's.semester',
            'isActive' => 's.isActive',
            'createdAt' => 's.createdAt',
            'updatedAt' => 's.updatedAt',
        ];
        $sortField = (string) ($filters['sort'] ?? 'code');
        $orderBy = $allowedSortFields[$sortField] ?? 's.code';
        $sortDir = strtoupper((string) ($filters['dir'] ?? 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
        $qb->orderBy($orderBy, $sortDir);

        return $qb->getQuery()->getResult();
    }

    /**
     * Get subject by ID
     */
    public function getSubjectById(int $id): ?Subject
    {
        return $this->subjectRepository->find($id);
    }

    /**
     * Create a new subject
     */
    public function createSubject(Subject $subject): Subject
    {
        $subject->setCreatedAt(new \DateTime());
        $subject->setUpdatedAt(new \DateTime());

        $this->entityManager->persist($subject);
        $this->entityManager->flush();

        return $subject;
    }

    /**
     * Update an existing subject
     */
    public function updateSubject(Subject $subject): Subject
    {
        $subject->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();

        return $subject;
    }

    /**
     * Soft delete a subject
     */
    public function deleteSubject(Subject $subject): void
    {
        $subject->setDeletedAt(new \DateTime());
        $this->entityManager->flush();
    }

    /**
     * Toggle subject active status
     */
    public function toggleActiveStatus(Subject $subject): Subject
    {
        $subject->setIsActive(!$subject->isActive());
        $subject->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();

        return $subject;
    }

    /**
     * Get subject statistics
     */
    public function getSubjectStatistics(): array
    {
        return $this->subjectRepository->getStatistics();
    }

    /**
     * Get subjects by department
     */
    public function getSubjectsByDepartment(int $departmentId): array
    {
        return $this->subjectRepository->findByDepartment($departmentId);
    }

    /**
     * Get subjects by department from published curricula only
     */
    public function getSubjectsByDepartmentFromPublishedCurricula(int $departmentId): array
    {
        return $this->subjectRepository->findByDepartmentFromPublishedCurricula($departmentId);
    }

    /**
     * Get all active subjects from published curricula only
     */
    public function getActiveSubjectsFromPublishedCurricula(): array
    {
        return $this->subjectRepository->findActiveFromPublishedCurricula();
    }

    /**
     * Check if subject code exists
     */
    public function isCodeAvailable(string $code, ?int $excludeId = null): bool
    {
        $subject = $this->subjectRepository->findByCode($code);
        
        if (!$subject) {
            return true;
        }

        // If we're updating, exclude the current subject
        if ($excludeId && $subject->getId() === $excludeId) {
            return true;
        }

        return false;
    }

    /**
     * Check if subject is in any published curriculum
     */
    public function isInPublishedCurriculum(int $subjectId): bool
    {
        return $this->subjectRepository->isInPublishedCurriculum($subjectId);
    }
}
