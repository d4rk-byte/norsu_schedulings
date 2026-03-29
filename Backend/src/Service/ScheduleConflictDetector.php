<?php

namespace App\Service;

use App\Entity\Schedule;
use App\Entity\Subject;
use App\Repository\ScheduleRepository;
use Doctrine\ORM\EntityManagerInterface;

class ScheduleConflictDetector
{
    private const DAY_TOKEN_ORDER = ['M', 'T', 'W', 'TH', 'F', 'SAT', 'SUN'];
    private const TOKEN_TO_DAY_NAME = [
        'M' => 'Monday',
        'T' => 'Tuesday',
        'W' => 'Wednesday',
        'TH' => 'Thursday',
        'F' => 'Friday',
        'SAT' => 'Saturday',
        'SUN' => 'Sunday',
    ];

    private ScheduleRepository $scheduleRepository;
    private EntityManagerInterface $entityManager;
    private array $yearLevelCache = [];

    public function __construct(
        ScheduleRepository $scheduleRepository,
        EntityManagerInterface $entityManager
    ) {
        $this->scheduleRepository = $scheduleRepository;
        $this->entityManager = $entityManager;
    }

    /**
     * Normalize free-form day pattern input to canonical token format (e.g. M-W-F).
     */
    public function normalizeDayPattern(?string $pattern): ?string
    {
        if ($pattern === null) {
            return null;
        }

        $tokens = $this->extractDayTokens($pattern);
        return empty($tokens) ? null : implode('-', $tokens);
    }

    /**
     * Normalize free-form time input to 24-hour H:i format.
     */
    public function normalizeTimeInput(?string $time): ?string
    {
        if ($time === null) {
            return null;
        }

        $time = trim($time);
        if ($time === '') {
            return null;
        }

        if (!preg_match('/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/', $time, $matches)) {
            return null;
        }

        $hours = (int) $matches[1];
        $minutes = (int) $matches[2];
        $ampm = isset($matches[4]) && $matches[4] !== '' ? strtoupper($matches[4]) : null;

        if ($minutes > 59) {
            return null;
        }

        if ($ampm !== null) {
            if ($hours < 1 || $hours > 12) {
                return null;
            }
            if ($hours === 12) {
                $hours = 0;
            }
            if ($ampm === 'PM') {
                $hours += 12;
            }
        } else {
            if ($hours > 23) {
                return null;
            }
        }

        return sprintf('%02d:%02d', $hours, $minutes);
    }

    /**
     * Check if a schedule has conflicts with existing schedules
     * 
     * @param Schedule $schedule The schedule to check
     * @param bool $excludeSelf Whether to exclude the schedule itself (for updates)
     * @return array Array of conflicting schedules
     */
    public function detectConflicts(Schedule $schedule, bool $excludeSelf = false): array
    {
        $conflicts = [];
        $this->yearLevelCache = [];

        // Check room conflicts only if a room is assigned
        if ($schedule->getRoom()) {
            // Get all schedules for the same room (removed day pattern filter to check overlapping days)
            $qb = $this->entityManager->createQueryBuilder();
            $qb->select('s')
                ->from(Schedule::class, 's')
                ->where('s.room = :room')
                ->andWhere('s.academicYear = :academicYear')
                ->andWhere('s.semester = :semester')
                ->andWhere('s.status = :status')
                ->andWhere('s.startTime < :endTime')
                ->andWhere('s.endTime > :startTime')
                ->setParameter('room', $schedule->getRoom())
                ->setParameter('academicYear', $schedule->getAcademicYear())
                ->setParameter('semester', $schedule->getSemester())
                ->setParameter('status', 'active')
                ->setParameter('startTime', $schedule->getStartTime())
                ->setParameter('endTime', $schedule->getEndTime());

            // Exclude the schedule itself if it's an update
            if ($excludeSelf && $schedule->getId()) {
                $qb->andWhere('s.id != :scheduleId')
                    ->setParameter('scheduleId', $schedule->getId());
            }

            $existingSchedules = $qb->getQuery()->getResult();
            
            // Check for time overlaps AND day pattern overlaps
            foreach ($existingSchedules as $existing) {
                $hasDayOverlap = $this->hasDayOverlap($schedule->getDayPattern(), $existing->getDayPattern());
                $hasTimeOverlap = $this->hasTimeOverlap($schedule, $existing);
                
                // Check if day patterns overlap AND times overlap
                if ($hasDayOverlap && $hasTimeOverlap) {
                    $conflicts[] = [
                        'type' => 'room_time_conflict',
                        'schedule' => $existing,
                        'message' => sprintf(
                            'Room %s is already booked for %s (%s) from %s to %s (Section: %s)',
                            $existing->getRoom() ? ($existing->getRoom()->getCode() ?: ($existing->getRoom()->getName() ?: 'Unnamed Room')) : 'Unassigned',
                            $existing->getSubject() ? $existing->getSubject()->getCode() : 'Unknown',
                            $existing->getDayPattern(),
                            $existing->getStartTime()->format('g:i A'),
                            $existing->getEndTime()->format('g:i A'),
                            $existing->getSection() ?? 'N/A'
                        )
                    ];
                }
            }
        }

        // Check for subject-section conflicts (includes both duplicate detection and block sectioning)
        // - Duplicate detection: Same subject, same section scheduled multiple times
        // - Block sectioning: Different subjects, same section, same year level (cross-subject conflicts)
        if ($schedule->getSection()) {
            $sectionConflicts = $this->checkSectionConflicts($schedule, $excludeSelf);
            $conflicts = array_merge($conflicts, $sectionConflicts);
        }

        // Check for faculty conflicts (same faculty teaching at same time)
        if ($schedule->getFaculty()) {
            $facultyConflicts = $this->checkFacultyConflicts($schedule, $excludeSelf);
            $conflicts = array_merge($conflicts, $facultyConflicts);
        }

        return $conflicts;
    }

    /**
     * Check if two schedules have overlapping time periods
     */
    private function hasTimeOverlap(Schedule $schedule1, Schedule $schedule2): bool
    {
        $start1 = $schedule1->getStartTime();
        $end1 = $schedule1->getEndTime();
        $start2 = $schedule2->getStartTime();
        $end2 = $schedule2->getEndTime();

        // Convert to timestamps for comparison
        $start1Time = strtotime($start1->format('H:i:s'));
        $end1Time = strtotime($end1->format('H:i:s'));
        $start2Time = strtotime($start2->format('H:i:s'));
        $end2Time = strtotime($end2->format('H:i:s'));

        // Check for overlap: (start1 < end2) AND (end1 > start2)
        return ($start1Time < $end2Time) && ($end1Time > $start2Time);
    }

    /**
     * Check if two day patterns have overlapping days
     * 
     * @param string $pattern1 First day pattern (e.g., "Mon-Fri (Daily)", "M-W-F", "T-TH")
     * @param string $pattern2 Second day pattern
     * @return bool True if the patterns share at least one common day
     */
    private function hasDayOverlap(?string $pattern1, ?string $pattern2): bool
    {
        $days1 = $this->extractDays((string) $pattern1);
        $days2 = $this->extractDays((string) $pattern2);

        if (empty($days1) || empty($days2)) {
            return false;
        }
        
        $overlap = array_intersect($days1, $days2);

        // Check if there's any overlap
        return !empty($overlap);
    }

    /**
     * Extract individual days from a day pattern
     * 
     * @param string $pattern Day pattern (e.g., "M-T-TH-F", "M-W-F", "T-TH", "M-W")
     * @return array Array of day names
     */
    private function extractDays(string $pattern): array
    {
        $tokens = $this->extractDayTokens($pattern);
        return array_values(array_map(static function (string $token): string {
            return self::TOKEN_TO_DAY_NAME[$token];
        }, $tokens));
    }

    /**
     * Parse a day pattern into canonical ordered tokens.
     */
    private function extractDayTokens(string $pattern): array
    {
        $pattern = strtoupper(trim($pattern));
        if ($pattern === '') {
            return [];
        }

        // Remove parenthetical hints like "(Daily)".
        $pattern = preg_replace('/\([^)]*\)/', '', $pattern) ?? $pattern;

        if (preg_match('/\b(MON|M)\s*-\s*(FRI|F)\b/', $pattern) || strpos($pattern, 'WEEKDAY') !== false) {
            return ['M', 'T', 'W', 'TH', 'F'];
        }

        if (preg_match('/\b(MON|M)\s*-\s*SAT\b/', $pattern)) {
            return ['M', 'T', 'W', 'TH', 'F', 'SAT'];
        }

        if (strpos($pattern, 'WEEKEND') !== false) {
            return ['SAT', 'SUN'];
        }

        $pattern = str_replace(
            ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
            ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
            $pattern
        );

        $compact = preg_replace('/[^A-Z]/', '', $pattern) ?? '';
        if ($compact === '') {
            return [];
        }

        $tokenMap3 = [
            'MON' => 'M',
            'TUE' => 'T',
            'WED' => 'W',
            'THU' => 'TH',
            'FRI' => 'F',
            'SAT' => 'SAT',
            'SUN' => 'SUN',
        ];

        $tokenMap2 = [
            'MO' => 'M',
            'TU' => 'T',
            'WE' => 'W',
            'TH' => 'TH',
            'FR' => 'F',
            'SA' => 'SAT',
            'SU' => 'SUN',
        ];

        $tokens = [];
        $length = strlen($compact);
        $i = 0;

        while ($i < $length) {
            $chunk3 = substr($compact, $i, 3);
            if (isset($tokenMap3[$chunk3])) {
                $tokens[] = $tokenMap3[$chunk3];
                $i += 3;
                continue;
            }

            $chunk2 = substr($compact, $i, 2);
            if (isset($tokenMap2[$chunk2])) {
                $tokens[] = $tokenMap2[$chunk2];
                $i += 2;
                continue;
            }

            $char = $compact[$i];
            if (in_array($char, ['M', 'T', 'W', 'F'], true)) {
                $tokens[] = $char;
            } elseif ($char === 'S') {
                $tokens[] = 'SAT';
            }

            $i++;
        }

        $tokens = array_values(array_unique($tokens));

        return array_values(array_filter(self::DAY_TOKEN_ORDER, static function (string $token) use ($tokens): bool {
            return in_array($token, $tokens, true);
        }));
    }

    /**
     * Check for faculty conflicts
     * Faculty cannot teach two different classes at the same time
     */
    private function checkFacultyConflicts(Schedule $schedule, bool $excludeSelf = false): array
    {
        $conflicts = [];

        if (!$schedule->getFaculty()) {
            return $conflicts;
        }

        $qb = $this->entityManager->createQueryBuilder();
        $qb->select('s')
            ->from(Schedule::class, 's')
            ->where('s.faculty = :faculty')
            ->andWhere('s.academicYear = :academicYear')
            ->andWhere('s.semester = :semester')
            ->andWhere('s.status = :status')
            ->andWhere('s.startTime < :endTime')
            ->andWhere('s.endTime > :startTime')
            ->setParameter('faculty', $schedule->getFaculty())
            ->setParameter('academicYear', $schedule->getAcademicYear())
            ->setParameter('semester', $schedule->getSemester())
            ->setParameter('status', 'active')
            ->setParameter('startTime', $schedule->getStartTime())
            ->setParameter('endTime', $schedule->getEndTime());

        if ($excludeSelf && $schedule->getId()) {
            $qb->andWhere('s.id != :scheduleId')
                ->setParameter('scheduleId', $schedule->getId());
        }

        $existingSchedules = $qb->getQuery()->getResult();

        foreach ($existingSchedules as $existing) {
            // Check if day patterns overlap AND times overlap
            if ($this->hasDayOverlap($schedule->getDayPattern(), $existing->getDayPattern())
                && $this->hasTimeOverlap($schedule, $existing)) {
                $conflicts[] = [
                    'type' => 'faculty_conflict',
                    'schedule' => $existing,
                    'message' => sprintf(
                        'Faculty %s is already teaching %s (Section %s) on %s from %s to %s in Room %s',
                        $existing->getFaculty() ? $existing->getFaculty()->getFullName() : 'Unknown',
                        $existing->getSubject() ? $existing->getSubject()->getCode() : 'Unknown',
                        $existing->getSection() ?? 'N/A',
                        $existing->getDayPattern(),
                        $existing->getStartTime()->format('g:i A'),
                        $existing->getEndTime()->format('g:i A'),
                        $existing->getRoom() ? ($existing->getRoom()->getCode() ?: ($existing->getRoom()->getName() ?: 'Unnamed Room')) : 'No Room Assigned'
                    )
                ];
            }
        }

        return $conflicts;
    }

    /**
     * Check for section conflicts - detects when the same section is scheduled at the same time
     * This includes both:
     * 1. Duplicate detection: Same subject and section scheduled multiple times
     * 2. Cross-subject conflicts: Different subjects, same section (if same year level)
     */
    private function checkSectionConflicts(Schedule $schedule, bool $excludeSelf = false): array
    {
        $conflicts = [];

        if (!$schedule->getSection() || !$schedule->getSubject()) {
            return $conflicts;
        }

        $subject = $schedule->getSubject();
        $section = $schedule->getSection();
        
        // Get department for filtering
        $department = $subject->getDepartment();
        if (!$department) {
            error_log("[Section Conflict Debug] No department found for subject - skipping conflict check");
            return $conflicts;
        }

        // Automatically look up year level from curriculum
        $yearLevel = $this->getYearLevelFromCurriculum($subject, $schedule->getSemester());
        
        // Find all schedules with the SAME section in the SAME academic year and semester
        $qb = $this->entityManager->createQueryBuilder();
        $qb->select('s')
            ->from(Schedule::class, 's')
            ->innerJoin('s.subject', 'subj')
            ->where('s.section = :section')
            ->andWhere('subj.department = :department')   // CRITICAL: Must be same department
            ->andWhere('s.academicYear = :academicYear')
            ->andWhere('s.semester = :semester')
            ->andWhere('s.status = :status')
            ->andWhere('s.startTime < :endTime')
            ->andWhere('s.endTime > :startTime')
            ->setParameter('section', $section)
            ->setParameter('department', $department)
            ->setParameter('academicYear', $schedule->getAcademicYear())
            ->setParameter('semester', $schedule->getSemester())
            ->setParameter('status', 'active')
            ->setParameter('startTime', $schedule->getStartTime())
            ->setParameter('endTime', $schedule->getEndTime());

        if ($excludeSelf && $schedule->getId()) {
            $qb->andWhere('s.id != :scheduleId')
                ->setParameter('scheduleId', $schedule->getId());
        }

        $existingSchedules = $qb->getQuery()->getResult();

        error_log(sprintf(
            "[Section Conflict Debug] Checking %s (Dept: %s, Year %s, Section %s) - Found %d existing schedules",
            $subject->getCode(),
            $department->getName(),
            $yearLevel ?: 'NULL',
            $section,
            count($existingSchedules)
        ));

        foreach ($existingSchedules as $existing) {
            $existingSubject = $existing->getSubject();
            $isSameSubject = ($existingSubject->getId() === $subject->getId());
            
            // Automatically look up year level for the existing schedule's subject
            $existingYearLevel = $this->getYearLevelFromCurriculum($existingSubject, $existing->getSemester());
            
            error_log(sprintf(
                "[Section Conflict Debug] Comparing with %s (Year %s, Section %s, Days: %s vs %s, Time: %s-%s vs %s-%s)",
                $existingSubject->getCode(),
                $existingYearLevel ?: 'NULL',
                $existing->getSection(),
                $schedule->getDayPattern(),
                $existing->getDayPattern(),
                $schedule->getStartTime()->format('H:i'),
                $schedule->getEndTime()->format('H:i'),
                $existing->getStartTime()->format('H:i'),
                $existing->getEndTime()->format('H:i')
            ));

            // For SAME subject: Always check conflict (duplicate detection)
            // For DIFFERENT subjects: Only check if both have year level data AND they match
            $shouldCheck = $isSameSubject || 
                          ($yearLevel && $existingYearLevel && $yearLevel === $existingYearLevel);
            
            if (!$shouldCheck) {
                error_log("[Section Conflict Debug] Skipping - different subjects with no matching year level");
                continue;
            }

            // Check if day patterns overlap AND times overlap
            if ($this->hasDayOverlap($schedule->getDayPattern(), $existing->getDayPattern())
                && $this->hasTimeOverlap($schedule, $existing)) {
                
                if ($isSameSubject) {
                    error_log("[Section Conflict Debug] DUPLICATE FOUND!");
                    $conflicts[] = [
                        'type' => 'section_conflict',
                        'schedule' => $existing,
                        'message' => sprintf(
                            'DUPLICATE: Section %s is already scheduled for %s (%s) from %s to %s in %s',
                            $section,
                            $existingSubject->getCode(),
                            $existing->getDayPattern(),
                            $existing->getStartTime()->format('g:i A'),
                            $existing->getEndTime()->format('g:i A'),
                            $existing->getRoom() ? ('Room ' . ($existing->getRoom()->getCode() ?: ($existing->getRoom()->getName() ?: 'Unnamed'))) : 'No Room Assigned'
                        )
                    ];
                } else {
                    error_log(sprintf(
                        "[Section Conflict Debug] CROSS-SUBJECT CONFLICT FOUND: %s vs %s (both Year %s)",
                        $subject->getCode(),
                        $existingSubject->getCode(),
                        $yearLevel
                    ));
                    $conflicts[] = [
                        'type' => 'section_conflict',
                        'schedule' => $existing,
                        'message' => sprintf(
                            'SECTION CONFLICT: Year %s Section %s students cannot attend both %s and %s at the same time (%s, %s - %s). Faculty: %s, Room: %s',
                            $yearLevel,
                            $section,
                            $subject->getCode(),
                            $existingSubject->getCode(),
                            $existing->getDayPattern(),
                            $existing->getStartTime()->format('g:i A'),
                            $existing->getEndTime()->format('g:i A'),
                            $existing->getFaculty() ? $existing->getFaculty()->getFullName() : 'Unassigned',
                            $existing->getRoom() ? ($existing->getRoom()->getCode() ?: ($existing->getRoom()->getName() ?: 'Unnamed Room')) : 'No Room Assigned'
                        )
                    ];
                }
            }
        }

        return $conflicts;
    }

    /**
     * Check for block sectioning conflicts
     * In block sectioning, students in the same year level and section take ALL subjects together
     * Therefore, if two different subjects are scheduled for the same section at the same time,
     * students cannot attend both classes
     * 
     * NOTE: This automatically looks up year level from curriculum structure (no manual linking needed)
     */
    private function checkBlockSectioningConflicts(Schedule $schedule, bool $excludeSelf = false): array
    {
        $conflicts = [];
        $section = $schedule->getSection();

        // Skip if no section defined
        if (!$section) {
            return $conflicts;
        }

        $subject = $schedule->getSubject();
        if (!$subject) {
            return $conflicts;
        }

        // Automatically look up year level from curriculum_subjects → curriculum_terms
        $yearLevel = $this->getYearLevelFromCurriculum($subject, $schedule->getSemester());
        
        // Skip if no year level found in curriculum
        if (!$yearLevel) {
            return $conflicts;
        }
        
        // Get the department from the subject
        $department = $subject->getDepartment();
        if (!$department) {
            error_log("[Block Sectioning Debug] No department found for subject - skipping conflict check");
            return $conflicts;
        }
            
        // Find all schedules with the SAME section in the SAME academic year and semester
        $qb = $this->entityManager->createQueryBuilder();
        $qb->select('s')
            ->from(Schedule::class, 's')
            ->innerJoin('s.subject', 'subj')
            ->where('s.section = :section')
            ->andWhere('subj.department = :department')   // CRITICAL: Must be same department
            ->andWhere('s.subject != :subject')           // Different subject
            ->andWhere('s.academicYear = :academicYear')
            ->andWhere('s.semester = :semester')
            ->andWhere('s.status = :status')
            ->andWhere('s.startTime < :endTime')
            ->andWhere('s.endTime > :startTime')
            ->setParameter('section', $section)
            ->setParameter('department', $department)
            ->setParameter('subject', $schedule->getSubject())
            ->setParameter('academicYear', $schedule->getAcademicYear())
            ->setParameter('semester', $schedule->getSemester())
            ->setParameter('status', 'active')
            ->setParameter('startTime', $schedule->getStartTime())
            ->setParameter('endTime', $schedule->getEndTime());

        if ($excludeSelf && $schedule->getId()) {
            $qb->andWhere('s.id != :scheduleId')
                ->setParameter('scheduleId', $schedule->getId());
        }

        $existingSchedules = $qb->getQuery()->getResult();
        
        // DEBUG: Log what we're comparing
        error_log(sprintf(
            "[Block Sectioning Debug] Checking %s (Dept: %s, Year %s, Section %s) against %d existing schedules",
            $schedule->getSubject()->getCode(),
            $department->getName(),
            $yearLevel,
            $section,
            count($existingSchedules)
        ));

        foreach ($existingSchedules as $existing) {
            // Automatically look up year level for the existing schedule's subject
            $existingYearLevel = $this->getYearLevelFromCurriculum($existing->getSubject(), $existing->getSemester());
            
            error_log(sprintf(
                "[Block Sectioning Debug] Comparing with %s (Year %s, Section %s, Days: %s)",
                $existing->getSubject()->getCode(),
                $existingYearLevel ?: 'NULL',
                $existing->getSection(),
                $existing->getDayPattern()
            ));
            
            // Only check conflict if both schedules have year level data AND they match
            if (!$existingYearLevel || $existingYearLevel !== $yearLevel) {
                continue;
            }
            
            // Check if day patterns overlap AND times overlap
            if ($this->hasDayOverlap($schedule->getDayPattern(), $existing->getDayPattern())
                && $this->hasTimeOverlap($schedule, $existing)) {
                
                error_log(sprintf(
                    "[Block Sectioning Debug] CONFLICT FOUND: %s vs %s (both Year %s)",
                    $schedule->getSubject()->getCode(),
                    $existing->getSubject()->getCode(),
                    $yearLevel
                ));

                $conflicts[] = [
                    'type' => 'block_sectioning_conflict',
                    'schedule' => $existing,
                    'message' => sprintf(
                        'BLOCK SECTIONING CONFLICT: Year %s Section %s students cannot attend both %s and %s at the same time (%s, %s - %s). Faculty: %s, Room: %s',
                        $yearLevel,
                        $section,
                        $schedule->getSubject()->getCode(),
                        $existing->getSubject()->getCode(),
                        $existing->getDayPattern(),
                        $existing->getStartTime()->format('g:i A'),
                        $existing->getEndTime()->format('g:i A'),
                        $existing->getFaculty() ? $existing->getFaculty()->getFullName() : 'Unassigned',
                        $existing->getRoom() ? ($existing->getRoom()->getCode() ?: ($existing->getRoom()->getName() ?: 'Unnamed Room')) : 'No Room Assigned'
                    )
                ];
            }
        }

        return $conflicts;
    }

    /**
     * Check if the same subject-section combination already exists (duplicate check)
     */
    public function checkDuplicateSubjectSection(Schedule $schedule, bool $excludeSelf = false): array
    {
        $conflicts = [];

        if (!$schedule->getSubject() || !$schedule->getSection()) {
            return $conflicts;
        }

        $qb = $this->entityManager->createQueryBuilder();
        $qb->select('s')
            ->from(Schedule::class, 's')
            ->where('s.subject = :subject')
            ->andWhere('s.section = :section')
            ->andWhere('s.academicYear = :academicYear')
            ->andWhere('s.semester = :semester')
            ->andWhere('s.status = :status')
            ->setParameter('subject', $schedule->getSubject())
            ->setParameter('section', $schedule->getSection())
            ->setParameter('academicYear', $schedule->getAcademicYear())
            ->setParameter('semester', $schedule->getSemester())
            ->setParameter('status', 'active');

        if ($excludeSelf && $schedule->getId()) {
            $qb->andWhere('s.id != :scheduleId')
                ->setParameter('scheduleId', $schedule->getId());
        }

        $existingSchedules = $qb->getQuery()->getResult();

        foreach ($existingSchedules as $existing) {
            $conflicts[] = [
                'type' => 'duplicate_subject_section',
                'schedule' => $existing,
                'message' => sprintf(
                    'Subject %s Section %s already exists on %s from %s to %s in %s',
                    $existing->getSubject() ? $existing->getSubject()->getCode() : 'Unknown',
                    $existing->getSection() ?? 'N/A',
                    $existing->getDayPattern(),
                    $existing->getStartTime()->format('g:i A'),
                    $existing->getEndTime()->format('g:i A'),
                    $existing->getRoom() ? ('Room ' . ($existing->getRoom()->getCode() ?: ($existing->getRoom()->getName() ?: 'Unnamed'))) : 'No Room Assigned'
                )
            ];
        }

        return $conflicts;
    }

    /**
     * Get a summary of conflicts for display
     */
    public function getConflictSummary(array $conflicts): string
    {
        if (empty($conflicts)) {
            return 'No conflicts detected.';
        }

        $summary = sprintf('%d conflict(s) detected:<br>', count($conflicts));
        foreach ($conflicts as $conflict) {
            $summary .= '• ' . $conflict['message'] . '<br>';
        }

        return $summary;
    }

    /**
     * Mark a schedule as conflicted or not
     */
    public function updateConflictStatus(Schedule $schedule): void
    {
        $conflicts = $this->detectConflicts($schedule, true);
        $schedule->setIsConflicted(!empty($conflicts));
    }

    /**
     * Validate schedule time ranges
     */
    public function validateTimeRange(Schedule $schedule): array
    {
        $errors = [];

        $startTime = $schedule->getStartTime();
        $endTime = $schedule->getEndTime();

        if ($startTime >= $endTime) {
            $errors[] = 'End time must be after start time.';
        }

        // Check if time range is reasonable (e.g., not more than 8 hours)
        $duration = $endTime->getTimestamp() - $startTime->getTimestamp();
        $hours = $duration / 3600;

        if ($hours > 8) {
            $errors[] = 'Schedule duration cannot exceed 8 hours.';
        }

        if ($hours < 0.5) {
            $errors[] = 'Schedule duration must be at least 30 minutes.';
        }

        return $errors;
    }

    /**
     * Check room capacity vs enrolled students
     */
    public function validateRoomCapacity(Schedule $schedule): array
    {
        $errors = [];
        $room = $schedule->getRoom();
        $enrolledStudents = $schedule->getEnrolledStudents();

        if ($room && $enrolledStudents > 0) {
            $capacity = $room->getCapacity();
            if ($capacity && $enrolledStudents > $capacity) {
                $errors[] = sprintf(
                    'Enrolled students (%d) exceeds room capacity (%d).',
                    $enrolledStudents,
                    $capacity
                );
            }
        }

        return $errors;
    }

    /**
     * Scan all schedules and update their conflict status
     * This method checks all active schedules and marks them as conflicted if they have conflicts
     * 
     * @param int|null $departmentId Optional department ID to limit scanning to specific department
     * @return array Statistics about the scan (total_scanned, conflicts_found, schedules_updated)
     */
    public function scanAndUpdateAllConflicts(?int $departmentId = null): array
    {
        $qb = $this->entityManager->createQueryBuilder();
        $qb->select('s')
            ->from(Schedule::class, 's')
            ->where('s.status = :status')
            ->setParameter('status', 'active');

        // Filter by department if provided
        if ($departmentId) {
            $qb->join('s.subject', 'subj')
               ->andWhere('subj.department = :deptId')
               ->setParameter('deptId', $departmentId);
        }

        $allSchedules = $qb->getQuery()->getResult();
        
        $stats = [
            'total_scanned' => count($allSchedules),
            'conflicts_found' => 0,
            'schedules_updated' => 0,
        ];

        foreach ($allSchedules as $schedule) {
            $oldStatus = $schedule->getIsConflicted();
            $conflicts = $this->detectConflicts($schedule, true);
            $hasConflicts = !empty($conflicts);
            
            $schedule->setIsConflicted($hasConflicts);
            
            if ($hasConflicts) {
                $stats['conflicts_found']++;
            }
            
            // Track if status changed
            if ($oldStatus !== $hasConflicts) {
                $stats['schedules_updated']++;
            }
        }

        // Persist all changes
        $this->entityManager->flush();

        return $stats;
    }

    /**
     * Get all conflicted schedules for a department
     * 
     * @param int|null $departmentId Department ID to filter by
     * @param object|null $academicYear Academic year to filter by
     * @param string|null $semester Semester to filter by
     * @return array Array of schedules with their conflicts
     */
    public function getConflictedSchedulesWithDetails(?int $departmentId = null, ?object $academicYear = null, ?string $semester = null): array
    {
        $qb = $this->entityManager->createQueryBuilder();
        $qb->select('s')
            ->from(Schedule::class, 's')
            ->where('s.status = :status')
            ->setParameter('status', 'active');

        if ($departmentId) {
            $qb->join('s.subject', 'subj')
               ->andWhere('subj.department = :deptId')
               ->setParameter('deptId', $departmentId);
        }

        if ($academicYear) {
            $qb->andWhere('s.academicYear = :academicYear')
               ->setParameter('academicYear', $academicYear);
        }

        if ($semester) {
            $qb->andWhere('s.semester = :semester')
               ->setParameter('semester', $semester);
        }

        $schedules = $qb->getQuery()->getResult();
        $conflictedSchedules = [];

        foreach ($schedules as $schedule) {
            $conflicts = $this->detectConflicts($schedule, true);
            if (!empty($conflicts)) {
                $conflictedSchedules[] = [
                    'schedule' => $schedule,
                    'conflicts' => $conflicts,
                    'conflict_count' => count($conflicts),
                ];
            }
        }

        return $conflictedSchedules;
    }

    /**
     * Automatically look up year level from curriculum structure
     * Searches curriculum_subjects → curriculum_terms based on subject and semester
     * No manual linking required - works automatically like room/time conflicts
     * 
     * @param Subject $subject The subject to look up
     * @param string $semester The semester (e.g., "1st Semester", "2nd Semester")
     * @return int|null The year level (1-4) or null if not found in curriculum
     */
    private function getYearLevelFromCurriculum(Subject $subject, string $semester): ?int
    {
        $cacheKey = $subject->getId() . '_' . $semester;
        if (array_key_exists($cacheKey, $this->yearLevelCache)) {
            return $this->yearLevelCache[$cacheKey];
        }

        try {
            $qb = $this->entityManager->createQueryBuilder();
            $qb->select('ct.year_level')
                ->from('App\Entity\CurriculumSubject', 'cs')
                ->innerJoin('cs.curriculumTerm', 'ct')
                ->where('cs.subject = :subject')
                ->andWhere('ct.semester = :semester')
                ->setParameter('subject', $subject)
                ->setParameter('semester', $semester)
                ->setMaxResults(1);

            $result = $qb->getQuery()->getOneOrNullResult();
            
            $yearLevel = ($result && isset($result['year_level'])) ? (int) $result['year_level'] : null;
            $this->yearLevelCache[$cacheKey] = $yearLevel;
            return $yearLevel;
        } catch (\Exception $e) {
            error_log("[Year Level Lookup] Error looking up year level for subject {$subject->getCode()}: {$e->getMessage()}");
            $this->yearLevelCache[$cacheKey] = null;
            return null;
        }
    }}