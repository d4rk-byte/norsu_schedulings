<?php

namespace App\Service;

use App\Entity\Curriculum;
use App\Entity\CurriculumSubject;
use App\Entity\CurriculumTerm;
use App\Entity\Subject;
use App\Repository\SubjectRepository;
use App\Repository\CurriculumSubjectRepository;
use App\Repository\CurriculumTermRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class CurriculumUploadService
{
    private EntityManagerInterface $entityManager;
    private SubjectRepository $subjectRepository;
    private CurriculumSubjectRepository $curriculumSubjectRepository;
    private CurriculumTermRepository $curriculumTermRepository;

    public function __construct(
        EntityManagerInterface $entityManager,
        SubjectRepository $subjectRepository,
        CurriculumSubjectRepository $curriculumSubjectRepository,
        CurriculumTermRepository $curriculumTermRepository
    ) {
        $this->entityManager = $entityManager;
        $this->subjectRepository = $subjectRepository;
        $this->curriculumSubjectRepository = $curriculumSubjectRepository;
        $this->curriculumTermRepository = $curriculumTermRepository;
    }

    /**
     * Process uploaded curriculum file and create subjects/terms
     *
     * @param UploadedFile $file
     * @param Curriculum $curriculum
     * @param bool $autoCreateTerms
     * @param bool $validateOnly
     * @return array
     */
    public function processUpload(
        UploadedFile $file,
        Curriculum $curriculum,
        bool $autoCreateTerms = true,
        bool $validateOnly = false
    ): array {
        // Parse the file
        $parseResult = $this->parseFile($file);
        
        if (!$parseResult['success']) {
            return $parseResult;
        }

        $subjects = $parseResult['subjects'];
        $parseErrors = $parseResult['errors'] ?? [];

        // Validate data
        $validationResult = $this->validateSubjects($subjects, $curriculum);
        if (!$validationResult['success']) {
            return $validationResult;
        }

        // If validation only, return results
        if ($validateOnly) {
            return [
                'success' => true,
                'message' => 'Validation successful',
                'total_subjects' => count($subjects),
                'warnings' => $validationResult['warnings'] ?? [],
                'parse_errors' => $parseErrors
            ];
        }

        // Process and save subjects
        return $this->saveSubjects($subjects, $curriculum, $autoCreateTerms, $parseErrors);
    }

    /**
     * Parse curriculum file (CSV or Excel)
     *
     * @param UploadedFile $file
     * @return array
     */
    private function parseFile(UploadedFile $file): array
    {
        // Validate by MIME type (not user-supplied extension) to prevent bypass
        $mimeType = $file->getMimeType();
        $allowedMimes = [
            'text/plain'       => 'csv',
            'text/csv'         => 'csv',
            'application/csv'  => 'csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            'application/vnd.ms-excel' => 'xls',
        ];

        if (!isset($allowedMimes[$mimeType])) {
            return [
                'success' => false,
                'message' => 'Unsupported file format. Supported formats: CSV, XLSX, XLS'
            ];
        }

        $type = $allowedMimes[$mimeType];
        $path = $file->getPathname();

        try {
            if ($type === 'csv') {
                return $this->parseCsvFile($path);
            } else {
                return $this->parseExcelFile($path);
            }
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Error parsing file: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Parse CSV file
     *
     * @param string $path
     * @return array
     */
    private function parseCsvFile(string $path): array
    {
        $subjects = [];
        $errors = [];
        
        if (($handle = fopen($path, 'r')) === false) {
            return [
                'success' => false,
                'message' => 'Unable to open CSV file'
            ];
        }

        // Read header row
        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            return [
                'success' => false,
                'message' => 'Empty CSV file'
            ];
        }

        // Expected columns
        $expectedColumns = ['code', 'title', 'units', 'lec', 'lab', 'year_level', 'semester'];
        $rowNumber = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowNumber++;
            
            // Skip empty rows
            if (empty(array_filter($row))) {
                continue;
            }

            // Check minimum required columns
            if (count($row) < 7) {
                $errors[] = "Row {$rowNumber}: Insufficient columns (minimum 7 required)";
                continue;
            }

            try {
                $subjectData = [
                    'code' => trim($row[0]),
                    'title' => trim($row[1]),
                    'units' => $this->parseInteger($row[2], 'units'),
                    'lec' => $this->parseInteger($row[3], 'lecture hours'),
                    'lab' => $this->parseInteger($row[4], 'lab hours'),
                    'year_level' => $this->parseInteger($row[5], 'year level'),
                    'semester' => $this->parseSemester($row[6]), // Parse as string: '1st', '2nd', 'summer'
                    'type' => isset($row[7]) && trim($row[7]) !== '' ? trim($row[7]) : 'lecture',
                    'required' => isset($row[8]) ? $this->parseBoolean($row[8]) : true,
                    'row_number' => $rowNumber
                ];

                // Basic validation
                if (empty($subjectData['code'])) {
                    $errors[] = "Row {$rowNumber}: Subject code is required";
                    continue;
                }
                if (empty($subjectData['title'])) {
                    $errors[] = "Row {$rowNumber}: Subject title is required";
                    continue;
                }

                $subjects[] = $subjectData;

            } catch (\Exception $e) {
                $errors[] = "Row {$rowNumber}: " . $e->getMessage();
            }
        }

        fclose($handle);

        if (empty($subjects) && empty($errors)) {
            $errors[] = "No valid subject data found in file";
        }

        return [
            'success' => !empty($subjects),
            'subjects' => $subjects,
            'errors' => $errors,
            'total_rows' => $rowNumber - 1
        ];
    }

    /**
     * Parse Excel file using PhpSpreadsheet
     *
     * @param string $path
     * @return array
     */
    private function parseExcelFile(string $path): array
    {
        // Check if PhpSpreadsheet is installed
        if (!class_exists('\PhpOffice\PhpSpreadsheet\IOFactory')) {
            return [
                'success' => false,
                'message' => 'Excel support requires PhpSpreadsheet library. Please install: composer require phpoffice/phpspreadsheet'
            ];
        }

        try {
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($path);
            $worksheet = $spreadsheet->getActiveSheet();
            $highestRow = $worksheet->getHighestRow();
            
            $subjects = [];
            $errors = [];

            // Start from row 2 (assuming row 1 is header)
            for ($row = 2; $row <= $highestRow; $row++) {
                // Skip empty rows
                if ($worksheet->getCell("A{$row}")->getValue() === null) {
                    continue;
                }

                try {
                    $subjectData = [
                        'code' => trim((string)$worksheet->getCell("A{$row}")->getValue()),
                        'title' => trim((string)$worksheet->getCell("B{$row}")->getValue()),
                        'units' => (int)$worksheet->getCell("C{$row}")->getValue(),
                        'lec' => (int)$worksheet->getCell("D{$row}")->getValue(),
                        'lab' => (int)$worksheet->getCell("E{$row}")->getValue(),
                        'year_level' => (int)$worksheet->getCell("F{$row}")->getValue(),
                        'semester' => $this->parseSemester((string)$worksheet->getCell("G{$row}")->getValue()), // Parse as string
                        'type' => trim((string)$worksheet->getCell("H{$row}")->getValue()) ?: 'lecture',
                        'required' => $this->parseBoolean((string)$worksheet->getCell("I{$row}")->getValue()),
                        'row_number' => $row
                    ];

                    // Basic validation
                    if (empty($subjectData['code'])) {
                        $errors[] = "Row {$row}: Subject code is required";
                        continue;
                    }
                    if (empty($subjectData['title'])) {
                        $errors[] = "Row {$row}: Subject title is required";
                        continue;
                    }

                    $subjects[] = $subjectData;

                } catch (\Exception $e) {
                    $errors[] = "Row {$row}: " . $e->getMessage();
                }
            }

            return [
                'success' => !empty($subjects),
                'subjects' => $subjects,
                'errors' => $errors,
                'total_rows' => $highestRow - 1
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Error reading Excel file: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Validate subjects data
     *
     * @param array $subjects
     * @param Curriculum $curriculum
     * @return array
     */
    private function validateSubjects(array $subjects, Curriculum $curriculum): array
    {
        $errors = [];
        $warnings = [];
        $codes = [];

        foreach ($subjects as $index => $subjectData) {
            $rowNum = $subjectData['row_number'] ?? ($index + 2);

            // Check for duplicate codes in file
            if (in_array($subjectData['code'], $codes)) {
                $warnings[] = "Row {$rowNum}: Duplicate subject code '{$subjectData['code']}' in file";
            }
            $codes[] = $subjectData['code'];

            // Validate year level
            if ($subjectData['year_level'] < 1 || $subjectData['year_level'] > 6) {
                $errors[] = "Row {$rowNum}: Invalid year level (must be 1-6)";
            }

            // Validate semester (accepts '1st', '2nd', 'summer')
            $validSemesters = ['1st', '2nd', 'summer'];
            if (!in_array(strtolower($subjectData['semester']), $validSemesters)) {
                $errors[] = "Row {$rowNum}: Invalid semester (must be '1st', '2nd', or 'summer')";
            }

            // Validate units
            if ($subjectData['units'] < 0 || $subjectData['units'] > 12) {
                $errors[] = "Row {$rowNum}: Invalid units (must be 0-12)";
            }

            // Validate hours
            if ($subjectData['lec'] < 0 || $subjectData['lab'] < 0) {
                $errors[] = "Row {$rowNum}: Hours cannot be negative";
            }

            // Validate type
            $validTypes = ['lecture', 'laboratory', 'lecture_lab', 'pe', 'nstp', 'internship'];
            if (!in_array($subjectData['type'], $validTypes)) {
                $warnings[] = "Row {$rowNum}: Unknown subject type '{$subjectData['type']}', using 'lecture'";
            }
        }

        return [
            'success' => empty($errors),
            'errors' => $errors,
            'warnings' => $warnings
        ];
    }

    /**
     * Save subjects to database
     *
     * @param array $subjects
     * @param Curriculum $curriculum
     * @param bool $autoCreateTerms
     * @param array $parseErrors
     * @return array
     */
    private function saveSubjects(
        array $subjects,
        Curriculum $curriculum,
        bool $autoCreateTerms,
        array $parseErrors = []
    ): array {
        $subjectsAdded = 0;
        $subjectsUpdated = 0;
        $termsCreated = [];
        $termCache = []; // Cache for terms created in this transaction
        $errors = [];

        try {
            foreach ($subjects as $subjectData) {
                $rowNum = $subjectData['row_number'] ?? 0;

                try {
                    // Find or create subject scoped to curriculum department.
                    // This allows same code (e.g., BPO) to exist independently per department.
                    $subject = $this->subjectRepository->findOneBy([
                        'code' => $subjectData['code'],
                        'department' => $curriculum->getDepartment(),
                    ]);
                    
                    if ($subject) {
                        // Update existing subject
                        $subject->setTitle($subjectData['title']);
                        $subject->setUnits($subjectData['units']);
                        $subject->setLectureHours($subjectData['lec']);
                        $subject->setLabHours($subjectData['lab']);
                        $subject->setType($subjectData['type']);
                        $subject->setYearLevel($subjectData['year_level']);
                        $subject->setSemester($subjectData['semester']);
                        $subject->setUpdatedAt(new \DateTimeImmutable());
                        $subjectsUpdated++;
                    } else {
                        // Create new subject
                        $subject = new Subject();
                        $subject->setCode($subjectData['code']);
                        $subject->setTitle($subjectData['title']);
                        $subject->setUnits($subjectData['units']);
                        $subject->setLectureHours($subjectData['lec']);
                        $subject->setLabHours($subjectData['lab']);
                        $subject->setType($subjectData['type']);
                        $subject->setYearLevel($subjectData['year_level']);
                        $subject->setSemester($subjectData['semester']);
                        $subject->setDepartment($curriculum->getDepartment());
                        $subject->setIsActive(true);
                        $subject->setCreatedAt(new \DateTimeImmutable());
                        $subject->setUpdatedAt(new \DateTimeImmutable());
                        $this->entityManager->persist($subject);
                        $subjectsAdded++;
                    }

                    // Find or create curriculum term
                    $termName = $this->generateTermName($subjectData['year_level'], $subjectData['semester']);
                    
                    // Check cache first to avoid duplicates in same transaction
                    if (isset($termCache[$termName])) {
                        $term = $termCache[$termName];
                    } else {
                        $term = $this->findOrCreateTerm(
                            $curriculum,
                            $termName,
                            $subjectData['year_level'],
                            $subjectData['semester'],
                            $autoCreateTerms
                        );
                        
                        if ($term) {
                            $termCache[$termName] = $term; // Cache it
                        }
                    }

                    if (!$term) {
                        $errors[] = "Row {$rowNum}: Term '{$termName}' not found and auto-create is disabled";
                        continue;
                    }

                    if (!isset($termsCreated[$termName])) {
                        $termsCreated[$termName] = $termName;
                    }

                    // Check if subject already exists in this term
                    $existingCurriculumSubject = $this->curriculumSubjectRepository->findOneBy([
                        'curriculumTerm' => $term,
                        'subject' => $subject
                    ]);

                    if ($existingCurriculumSubject) {
                        continue; // Skip if already exists
                    }

                    // Create curriculum subject link
                    $curriculumSubject = new CurriculumSubject();
                    $curriculumSubject->setCurriculumTerm($term);
                    $curriculumSubject->setSubject($subject);
                    $curriculumSubject->setCreatedAt(new \DateTimeImmutable());
                    $curriculumSubject->setUpdatedAt(new \DateTimeImmutable());
                    $this->entityManager->persist($curriculumSubject);

                } catch (\Exception $e) {
                    $errors[] = "Row {$rowNum}: " . $e->getMessage();
                }
            }

            // Flush all changes (transaction will be committed by the controller)
            $this->entityManager->flush();

            return [
                'success' => true,
                'message' => 'Curriculum uploaded successfully',
                'subjects_added' => $subjectsAdded,
                'subjects_updated' => $subjectsUpdated,
                'terms_created' => count($termsCreated),
                'total_subjects' => count($subjects),
                'errors' => array_merge($parseErrors, $errors),
                'curriculum_id' => $curriculum->getId()
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Error saving curriculum: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Find or create curriculum term
     *
     * @param Curriculum $curriculum
     * @param string $termName
     * @param int $yearLevel
     * @param string $semester ('1st', '2nd', 'summer')
     * @param bool $autoCreate
     * @return CurriculumTerm|null
     */
    private function findOrCreateTerm(
        Curriculum $curriculum,
        string $termName,
        int $yearLevel,
        string $semester,
        bool $autoCreate
    ): ?CurriculumTerm {
        // Search in existing terms
        foreach ($curriculum->getCurriculumTerms() as $term) {
            if ($term->getTermName() === $termName) {
                return $term;
            }
        }

        // Create new term if allowed
        if ($autoCreate) {
            $term = new CurriculumTerm();
            $term->setCurriculum($curriculum);
            $term->setTermName($termName);
            $term->setYearLevel($yearLevel);
            $term->setSemester($semester); // Already a string ('1st', '2nd', 'summer')
            $term->setCreatedAt(new \DateTimeImmutable());
            $term->setUpdatedAt(new \DateTimeImmutable());
            $this->entityManager->persist($term);
            return $term;
        }

        return null;
    }

    /**
     * Generate term name from year level and semester
     *
     * @param int $yearLevel
     * @param string $semester ('1st', '2nd', 'summer')
     * @return string
     */
    private function generateTermName(int $yearLevel, string $semester): string
    {
        $yearNames = [
            1 => '1st Year',
            2 => '2nd Year',
            3 => '3rd Year',
            4 => '4th Year',
            5 => '5th Year',
            6 => '6th Year'
        ];
        
        $semesterNames = [
            '1st' => '1st Semester',
            '2nd' => '2nd Semester',
            'summer' => 'Summer'
        ];
        
        $yearName = $yearNames[$yearLevel] ?? "Year {$yearLevel}";
        $semesterName = $semesterNames[strtolower($semester)] ?? ucfirst($semester);
        
        return "{$yearName} - {$semesterName}";
    }

    /**
     * Parse integer value
     *
     * @param mixed $value
     * @param string $fieldName
     * @return int
     */
    private function parseInteger($value, string $fieldName): int
    {
        if (!is_numeric($value)) {
            throw new \Exception("Invalid {$fieldName}: must be a number");
        }
        return (int)$value;
    }

    /**
     * Parse semester value - accepts '1st', '2nd', 'summer' or integers 1, 2, 3
     *
     * @param mixed $value
     * @return string Returns '1st', '2nd', or 'summer'
     */
    private function parseSemester($value): string
    {
        $value = trim(strtolower((string)$value));
        
        // Direct string matches
        $semesterMap = [
            '1st' => '1st',
            'first' => '1st',
            '1st semester' => '1st',
            '2nd' => '2nd',
            'second' => '2nd',
            '2nd semester' => '2nd',
            'summer' => 'summer',
            '3rd' => 'summer',
            'third' => 'summer'
        ];
        
        if (isset($semesterMap[$value])) {
            return $semesterMap[$value];
        }
        
        // Try numeric conversion (1 = '1st', 2 = '2nd', 3 = 'summer')
        if (is_numeric($value)) {
            $numValue = (int)$value;
            if ($numValue === 1) return '1st';
            if ($numValue === 2) return '2nd';
            if ($numValue === 3) return 'summer';
        }
        
        throw new \Exception("Invalid semester value: '{$value}'. Use '1st', '2nd', or 'summer'");
    }

    /**
     * Parse boolean value
     *
     * @param mixed $value
     * @return bool
     */
    private function parseBoolean($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        
        $strValue = strtolower(trim((string)$value));
        return in_array($strValue, ['yes', 'true', '1', 'y']);
    }

    /**
     * Generate CSV template matching NORSU curriculum format
     *
     * @return string
     */
    public function generateTemplate(): string
    {
        $csv = "Subject Code,Descriptive Title,Units,Lec,Lab,Year Level,Semester,Subject Type,Required\n";
        $csv .= "# NORSU Curriculum Template - Bachelor of Science in Information Technology\n";
        $csv .= "# Semester values: 1st, 2nd, summer (or use 1, 2, 3)\n";
        $csv .= "# Subject Types: lecture, laboratory, lecture_lab, pe, nstp\n";
        $csv .= "#\n";
        $csv .= "# FIRST YEAR - First Semester\n";
        $csv .= "GE 4,Mathematics in the Modern World,3,3,0,1,1st,lecture,yes\n";
        $csv .= "GE 5,Purposive Communication,3,3,0,1,1st,lecture,yes\n";
        $csv .= "ITS 100,Introduction to Computing,3,3,0,1,1st,lecture,yes\n";
        $csv .= "PE 1,Physical Education I,2,2,0,1,1st,pe,yes\n";
        $csv .= "NSTP 1,National Service Training Program I,3,3,0,1,1st,nstp,yes\n";
        $csv .= "#\n";
        $csv .= "# FIRST YEAR - Second Semester\n";
        $csv .= "GE 1,Understanding the Self,3,3,0,1,2nd,lecture,yes\n";
        $csv .= "ITS 103,Discrete Mathematics,3,3,0,1,2nd,lecture,yes\n";
        $csv .= "ITS 104,Computer Programming I,2,1,3,1,2nd,lecture_lab,yes\n";
        $csv .= "PE 2,Physical Education II,2,2,0,1,2nd,pe,yes\n";
        $csv .= "NSTP 2,National Service Training Program II,3,3,0,1,2nd,nstp,yes\n";
        $csv .= "#\n";
        $csv .= "# THIRD YEAR - Summer\n";
        $csv .= "ITS 400,Internship 1 (300 hours),3,0,0,3,summer,internship,yes\n";
        $csv .= "#\n";
        $csv .= "# FOURTH YEAR - First Semester\n";
        $csv .= "ITS 401,Internship 2 (500 hours),3,0,0,4,1st,internship,yes\n";
        $csv .= "ITS 402,Capstone Project 1,3,0,3,4,1st,laboratory,yes\n";
        
        return $csv;
    }
}
