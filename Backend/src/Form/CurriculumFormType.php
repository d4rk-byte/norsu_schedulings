<?php

namespace App\Form;

use App\Entity\College;
use App\Entity\Curriculum;
use App\Entity\Department;
use App\Repository\CollegeRepository;
use App\Repository\DepartmentRepository;
use App\Repository\AcademicYearRepository;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\IntegerType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;

class CurriculumFormType extends AbstractType
{
    private DepartmentRepository $departmentRepository;
    private CollegeRepository $collegeRepository;
    private AcademicYearRepository $academicYearRepository;

    public function __construct(
        DepartmentRepository $departmentRepository, 
        CollegeRepository $collegeRepository,
        AcademicYearRepository $academicYearRepository
    ) {
        $this->departmentRepository = $departmentRepository;
        $this->collegeRepository = $collegeRepository;
        $this->academicYearRepository = $academicYearRepository;
    }
    
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        // Check if we should show department/college fields
        // If show_department_fields is false, we're in a department-specific context
        $showDepartmentFields = $options['show_department_fields'] ?? false;
        
        $builder
            ->add('name', TextType::class, [
                'label' => 'Curriculum Name',
                'attr' => [
                    'placeholder' => 'e.g., Bachelor of Science in Computer Science',
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition duration-150'
                ],
                'constraints' => [
                    new Assert\NotBlank(message: 'Curriculum name is required'),
                    new Assert\Length(max: 255, maxMessage: 'Curriculum name cannot be longer than {{ limit }} characters')
                ]
            ]);
        
        // Only add college and department fields if explicitly requested (for admin global view)
        if ($showDepartmentFields) {
            // Get all active colleges for the college dropdown
            $colleges = $this->collegeRepository->createQueryBuilder('c')
                ->where('c.deletedAt IS NULL')
                ->orderBy('c.name', 'ASC')
                ->getQuery()
                ->getResult();
            
            $collegeChoices = [];
            foreach ($colleges as $college) {
                $collegeChoices[$college->getName() . ' (' . $college->getCode() . ')'] = $college->getId();
            }
            
            // Get all active departments for the department dropdown
            $departments = $this->departmentRepository->createQueryBuilder('d')
                ->leftJoin('d.college', 'c')
                ->addSelect('c')
                ->where('d.deletedAt IS NULL')
                ->andWhere('d.isActive = :active')
                ->setParameter('active', true)
                ->orderBy('d.name', 'ASC')
                ->getQuery()
                ->getResult();
            
            $departmentChoices = [];
            $departmentAttrs = [];
            foreach ($departments as $dept) {
                $departmentChoices[$dept->getName() . ' (' . $dept->getCode() . ')'] = $dept->getId();
                $departmentAttrs[$dept->getId()] = [
                    'data-college-id' => $dept->getCollege() ? $dept->getCollege()->getId() : ''
                ];
            }
            
            $builder
                ->add('collegeId', ChoiceType::class, [
                    'choices' => $collegeChoices,
                    'label' => 'College',
                    'placeholder' => 'Select College',
                    'attr' => [
                        'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition duration-150',
                        'id' => 'curriculum_collegeId'
                    ],
                    'required' => true,
                    'mapped' => false,
                    'constraints' => [
                        new Assert\NotBlank(message: 'College is required')
                    ],
                ])
                ->add('departmentId', ChoiceType::class, [
                    'choices' => $departmentChoices,
                    'choice_attr' => function($choice, $key, $value) use ($departmentAttrs) {
                        return $departmentAttrs[$value] ?? [];
                    },
                    'label' => 'Department',
                    'placeholder' => 'Select Department',
                    'attr' => [
                        'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition duration-150',
                        'id' => 'curriculum_departmentId'
                    ],
                    'mapped' => false,
                    'constraints' => [
                        new Assert\NotBlank(message: 'Department is required')
                    ],
                ]);
        }
        
        $builder
            ->add('version', IntegerType::class, [
                'label' => 'Version',
                'attr' => [
                    'placeholder' => '1',
                    'min' => 1,
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition duration-150'
                ],
                'required' => false,
                'data' => 1,
            ])
            ->add('effectiveYearId', ChoiceType::class, [
                'label' => 'Effective Academic Year',
                'placeholder' => '-- Optional --',
                'choices' => $this->getAcademicYearChoices(),
                'required' => false,
                'attr' => [
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition duration-150'
                ],
                'help' => 'Select the academic year when this curriculum becomes effective'
            ])
            ->add('notes', TextareaType::class, [
                'label' => 'Notes',
                'required' => false,
                'attr' => [
                    'placeholder' => 'Additional notes or description about this curriculum (optional)',
                    'rows' => 4,
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition duration-150'
                ]
            ])
            ->add('isPublished', CheckboxType::class, [
                'label' => 'Published',
                'required' => false,
                'attr' => [
                    'class' => 'h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500'
                ]
            ]);

        // Add event listener to set department from departmentId field
        if ($showDepartmentFields) {
            $builder->addEventListener(FormEvents::SUBMIT, function (FormEvent $event) {
                $curriculum = $event->getData();
                $form = $event->getForm();
                
                $departmentId = $form->get('departmentId')->getData();
                if ($departmentId) {
                    $department = $this->departmentRepository->find($departmentId);
                    if ($department) {
                        $curriculum->setDepartment($department);
                    }
                }
            });
        }
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => Curriculum::class,
            'show_department_fields' => false, // By default, don't show college/department fields
        ]);
    }

    /**
     * Get academic year choices for the dropdown
     */
    private function getAcademicYearChoices(): array
    {
        $academicYears = $this->academicYearRepository->findActive();
        $choices = [];
        
        foreach ($academicYears as $year) {
            $label = $year->getYear();
            if ($year->isCurrent()) {
                $label .= ' (Current)';
            }
            $choices[$label] = $year->getId();
        }
        
        return $choices;
    }
}
