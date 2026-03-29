<?php

namespace App\Service;

use App\Entity\DepartmentGroup;
use App\Entity\Department;
use App\Repository\DepartmentGroupRepository;
use App\Repository\DepartmentRepository;
use Doctrine\ORM\EntityManagerInterface;

class DepartmentGroupService
{
    public function __construct(
        private DepartmentGroupRepository $groupRepository,
        private DepartmentRepository $departmentRepository,
        private EntityManagerInterface $entityManager
    ) {
    }

    /**
     * Get all department groups with their departments
     */
    public function getAllGroupsWithDepartments(): array
    {
        return $this->groupRepository->findAllWithDepartments();
    }

    /**
     * Get a single department group with its departments
     */
    public function getGroupWithDepartments(int $id): ?DepartmentGroup
    {
        return $this->groupRepository->findOneWithDepartments($id);
    }

    /**
     * Get all ungrouped departments
     */
    public function getUngroupedDepartments(): array
    {
        return $this->departmentRepository->findBy([
            'departmentGroup' => null,
            'isActive' => true
        ], ['name' => 'ASC']);
    }

    /**
     * Create a new department group
     */
    public function createGroup(array $data): DepartmentGroup
    {
        $group = new DepartmentGroup();
        $group->setName($data['name'] ?? '');
        $group->setDescription($data['description'] ?? '');
        $group->setColor($data['color'] ?? '#6366f1'); // Default indigo color

        $this->entityManager->persist($group);
        $this->entityManager->flush();

        return $group;
    }

    /**
     * Update an existing department group
     */
    public function updateGroup(DepartmentGroup $group, array $data): DepartmentGroup
    {
        if (isset($data['name'])) {
            $group->setName($data['name']);
        }
        if (isset($data['description'])) {
            $group->setDescription($data['description']);
        }
        if (isset($data['color'])) {
            $group->setColor($data['color']);
        }

        $this->entityManager->flush();

        return $group;
    }

    /**
     * Delete a department group (unassigns all departments first)
     */
    public function deleteGroup(DepartmentGroup $group): void
    {
        // Unassign all departments from this group
        foreach ($group->getDepartments() as $department) {
            $department->setDepartmentGroup(null);
        }

        $this->entityManager->remove($group);
        $this->entityManager->flush();
    }

    /**
     * Assign a department to a group
     */
    public function assignDepartmentToGroup(Department $department, DepartmentGroup $group): void
    {
        $department->setDepartmentGroup($group);
        $this->entityManager->flush();
    }

    /**
     * Unassign a department from its group
     */
    public function unassignDepartment(Department $department): void
    {
        $department->setDepartmentGroup(null);
        $this->entityManager->flush();
    }

    /**
     * Get statistics for a department group
     */
    public function getGroupStatistics(DepartmentGroup $group): array
    {
        $departments = $group->getDepartments();
        $totalFaculty = 0;
        $totalSubjects = 0;

        foreach ($departments as $department) {
            // Count active faculty in this department
            $facultyCount = $this->departmentRepository
                ->createQueryBuilder('d')
                ->select('COUNT(u.id)')
                ->leftJoin('d.users', 'u')
                ->where('d.id = :departmentId')
                ->andWhere('u.role = :facultyRole')
                ->andWhere('u.isActive = true')
                ->setParameter('departmentId', $department->getId())
                ->setParameter('facultyRole', 3) // Faculty role
                ->getQuery()
                ->getSingleScalarResult();

            $totalFaculty += $facultyCount;

            // Count subjects could be added here if needed
            // $totalSubjects += count($department->getSubjects());
        }

        return [
            'department_count' => count($departments),
            'total_faculty' => $totalFaculty,
            'total_subjects' => $totalSubjects,
        ];
    }

    /**
     * Get all departments in a group's related departments (for faculty loading)
     */
    public function getDepartmentsForFacultyLoading(Department $department): array
    {
        $departmentGroup = $department->getDepartmentGroup();
        
        if ($departmentGroup) {
            return $departmentGroup->getDepartments()->toArray();
        }
        
        return [$department];
    }

    /**
     * Validate if a department can be assigned to a group
     */
    public function canAssignDepartmentToGroup(Department $department, DepartmentGroup $group): array
    {
        $errors = [];

        // Check if department is already in another group
        if ($department->getDepartmentGroup() && $department->getDepartmentGroup()->getId() !== $group->getId()) {
            $errors[] = sprintf(
                'Department "%s" is already assigned to group "%s"',
                $department->getName(),
                $department->getDepartmentGroup()->getName()
            );
        }

        // Check if department is active
        if (!$department->getIsActive()) {
            $errors[] = sprintf('Department "%s" is not active', $department->getName());
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }

    /**
     * Get group color options
     */
    public function getColorOptions(): array
    {
        return [
            '#6366f1' => 'Indigo',
            '#8b5cf6' => 'Purple',
            '#ec4899' => 'Pink',
            '#f43f5e' => 'Rose',
            '#ef4444' => 'Red',
            '#f97316' => 'Orange',
            '#f59e0b' => 'Amber',
            '#84cc16' => 'Lime',
            '#22c55e' => 'Green',
            '#14b8a6' => 'Teal',
            '#06b6d4' => 'Cyan',
            '#3b82f6' => 'Blue',
        ];
    }
}
