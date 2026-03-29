<?php

namespace App\Form;

use App\Entity\Subject;
use App\Repository\DepartmentRepository;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\IntegerType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints as Assert;

class SubjectFormType extends AbstractType
{
    private DepartmentRepository $departmentRepository;

    public function __construct(DepartmentRepository $departmentRepository)
    {
        $this->departmentRepository = $departmentRepository;
    }

    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        // Get all active departments
        $departments = $this->departmentRepository->findActive();
        $departmentChoices = [];
        
        foreach ($departments as $dept) {
            $departmentChoices[$dept->getName() . ' (' . $dept->getCode() . ')'] = $dept->getId();
        }

        $builder
            ->add('code', TextType::class, [
                'label' => 'Subject Code',
                'attr' => [
                    'placeholder' => 'e.g., CS101',
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150'
                ],
                'constraints' => [
                    new Assert\NotBlank(message: 'Subject code is required'),
                    new Assert\Length(max: 255, maxMessage: 'Subject code cannot be longer than {{ limit }} characters')
                ]
            ])
            ->add('title', TextType::class, [
                'label' => 'Subject Title',
                'attr' => [
                    'placeholder' => 'e.g., Introduction to Computer Science',
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150'
                ],
                'constraints' => [
                    new Assert\NotBlank(message: 'Subject title is required'),
                    new Assert\Length(max: 255, maxMessage: 'Subject title cannot be longer than {{ limit }} characters')
                ]
            ])
            ->add('description', TextareaType::class, [
                'label' => 'Description',
                'required' => false,
                'attr' => [
                    'placeholder' => 'Enter subject description...',
                    'rows' => 4,
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150'
                ]
            ])
            ->add('units', IntegerType::class, [
                'label' => 'Units',
                'attr' => [
                    'placeholder' => 'e.g., 3',
                    'min' => 1,
                    'max' => 12,
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150'
                ],
                'constraints' => [
                    new Assert\NotBlank(message: 'Units are required'),
                    new Assert\Range(min: 1, max: 12, notInRangeMessage: 'Units must be between {{ min }} and {{ max }}')
                ]
            ])
            ->add('lectureHours', IntegerType::class, [
                'label' => 'Lecture Hours',
                'required' => false,
                'attr' => [
                    'placeholder' => 'e.g., 3',
                    'min' => 0,
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150'
                ]
            ])
            ->add('labHours', IntegerType::class, [
                'label' => 'Laboratory Hours',
                'required' => false,
                'attr' => [
                    'placeholder' => 'e.g., 3',
                    'min' => 0,
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150'
                ]
            ])
            ->add('departmentId', ChoiceType::class, [
                'choices' => $departmentChoices,
                'label' => 'Department',
                'placeholder' => 'Select Department',
                'attr' => [
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150'
                ],
                'constraints' => [
                    new Assert\NotBlank(message: 'Department is required')
                ]
            ])
            ->add('type', ChoiceType::class, [
                'label' => 'Subject Type',
                'choices' => [
                    'Lecture' => 'lecture',
                    'Laboratory' => 'laboratory',
                    'Lecture & Laboratory' => 'lecture_lab'
                ],
                'attr' => [
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150'
                ],
                'constraints' => [
                    new Assert\NotBlank(message: 'Subject type is required')
                ]
            ])
            ->add('yearLevel', ChoiceType::class, [
                'label' => 'Year Level',
                'required' => false,
                'placeholder' => 'Select Year Level',
                'choices' => [
                    'Year 1' => 1,
                    'Year 2' => 2,
                    'Year 3' => 3,
                    'Year 4' => 4
                ],
                'attr' => [
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150'
                ]
            ])
            ->add('semester', ChoiceType::class, [
                'label' => 'Semester',
                'required' => false,
                'placeholder' => 'Select Semester',
                'choices' => [
                    '1st Semester' => '1st',
                    '2nd Semester' => '2nd',
                    'Summer' => 'Summer'
                ],
                'attr' => [
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150'
                ]
            ])
            ->add('isActive', CheckboxType::class, [
                'label' => 'Active Status',
                'required' => false,
                'attr' => [
                    'class' => 'rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
                ]
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => Subject::class,
        ]);
    }
}
