<?php

namespace App\Form;

use App\Entity\User;
use App\Entity\College;
use App\Entity\Department;
use App\Repository\CollegeRepository;
use App\Repository\DepartmentRepository;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\EmailType;
use Symfony\Component\Form\Extension\Core\Type\PasswordType;
use Symfony\Component\Form\Extension\Core\Type\RepeatedType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\Length;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;

class UserFormType extends AbstractType
{
    private CollegeRepository $collegeRepository;
    private DepartmentRepository $departmentRepository;

    public function __construct(CollegeRepository $collegeRepository, DepartmentRepository $departmentRepository)
    {
        $this->collegeRepository = $collegeRepository;
        $this->departmentRepository = $departmentRepository;
    }
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('username', TextType::class, [
                'attr' => [
                    'class' => 'form-control',
                    'placeholder' => 'Enter username'
                ],
                'label' => 'Username',
                'constraints' => [
                    new NotBlank([
                        'message' => 'Please enter a username',
                    ]),
                    new Length([
                        'min' => 3,
                        'minMessage' => 'Username should be at least {{ limit }} characters',
                        'max' => 255,
                    ]),
                ],
            ])
            ->add('firstName', TextType::class, [
                'attr' => [
                    'class' => 'form-control',
                    'placeholder' => 'Enter first name'
                ],
                'label' => 'First Name',
                'required' => false,
            ])
            ->add('middleName', TextType::class, [
                'attr' => [
                    'class' => 'form-control',
                    'placeholder' => 'Enter middle name (optional)'
                ],
                'label' => 'Middle Name',
                'required' => false,
            ])
            ->add('lastName', TextType::class, [
                'attr' => [
                    'class' => 'form-control',
                    'placeholder' => 'Enter last name'
                ],
                'label' => 'Last Name',
                'required' => false,
            ])
            ->add('email', EmailType::class, [
                'attr' => [
                    'class' => 'form-control',
                    'placeholder' => 'Enter email address'
                ],
                'label' => 'Email Address',
                'constraints' => [
                    new NotBlank([
                        'message' => 'Please enter an email address',
                    ]),
                ],
            ])
            ->add('employeeId', TextType::class, [
                'attr' => [
                    'class' => 'form-control',
                    'placeholder' => 'Enter employee ID'
                ],
                'label' => 'Employee ID',
                'constraints' => [
                    new NotBlank([
                        'message' => 'Please enter an employee ID',
                    ]),
                    new Length([
                        'min' => 6,
                        'minMessage' => 'Employee ID should be at least {{ limit }} characters',
                        'max' => 15,
                        'maxMessage' => 'Employee ID cannot be longer than {{ limit }} characters',
                    ]),
                ],
            ])
            ->add('position', ChoiceType::class, [
                'choices' => [
                    'Full-time' => 'Full-time',
                    'Part-time' => 'Part-time',
                    'Regular' => 'Regular',
                    'Contractual' => 'Contractual',
                    'Visiting' => 'Visiting',
                ],
                'attr' => [
                    'class' => 'form-control'
                ],
                'label' => 'Position/Title',
                'placeholder' => 'Select position/title',
                'required' => false,
            ])
            ->add('address', TextareaType::class, [
                'attr' => [
                    'class' => 'form-control',
                    'placeholder' => 'Enter address',
                    'rows' => 3
                ],
                'label' => 'Address',
                'required' => false,
            ])
            ->add('role', ChoiceType::class, [
                'choices' => [
                    'Administrator' => 1,
                    'Department Head' => 2,
                    'Faculty' => 3,
                ],
                'attr' => [
                    'class' => 'form-select',
                    'disabled' => $options['is_department_head'], // Disable for department heads
                ],
                'label' => 'Role',
                'placeholder' => false, // Remove placeholder to force selection
                'required' => true, // Explicitly mark as required
                'constraints' => [
                    new NotBlank([
                        'message' => 'Please select a role',
                    ]),
                ],
                'disabled' => $options['is_department_head'], // Lock role selection
            ])
            ->add('college', EntityType::class, [
                'class' => College::class,
                'choice_label' => 'name',
                'choice_value' => 'id',
                'query_builder' => function() {
                    return $this->collegeRepository->createQueryBuilder('c')
                        ->where('c.isActive = :active')
                        ->andWhere('c.deletedAt IS NULL')
                        ->setParameter('active', true)
                        ->orderBy('c.name', 'ASC');
                },
                'attr' => [
                    'class' => 'form-select',
                    'id' => 'college-select',
                ],
                'label' => 'College',
                'placeholder' => 'Select a college',
                'required' => false,
                'disabled' => $options['is_department_head'], // Lock college selection
            ])
            ->add('department', EntityType::class, [
                'class' => Department::class,
                'choice_label' => 'name',
                'choice_value' => 'id',
                'query_builder' => function() {
                    return $this->departmentRepository->createQueryBuilder('d')
                        ->leftJoin('d.college', 'c')
                        ->where('d.isActive = :active')
                        ->andWhere('d.deletedAt IS NULL')
                        ->andWhere('c.isActive = :active')
                        ->andWhere('c.deletedAt IS NULL')
                        ->setParameter('active', true)
                        ->orderBy('c.name', 'ASC')
                        ->addOrderBy('d.name', 'ASC');
                },
                'choice_attr' => function(Department $department) {
                    return ['data-college-id' => $department->getCollege() ? $department->getCollege()->getId() : ''];
                },
                'attr' => [
                    'class' => 'form-select',
                    'id' => 'department-select',
                ],
                'label' => 'Department',
                'placeholder' => 'Select a department',
                'required' => false,
                'disabled' => $options['is_department_head'], // Lock department selection
            ])
            ->add('isActive', CheckboxType::class, [
                'attr' => [
                    'class' => 'form-check-input'
                ],
                'label' => 'Active User',
                'required' => false,
                'data' => true, // Default to active
            ]);

        // Only add password field for new users
        if ($options['is_edit'] === false) {
            $builder->add('plainPassword', RepeatedType::class, [
                'type' => PasswordType::class,
                'mapped' => false,
                'attr' => ['autocomplete' => 'new-password'],
                'first_options' => [
                    'attr' => [
                        'class' => 'form-control',
                        'placeholder' => 'Enter password'
                    ],
                    'label' => 'Password',
                    'constraints' => [
                        new NotBlank([
                            'message' => 'Please enter a password',
                        ]),
                        new Length([
                            'min' => 6,
                            'minMessage' => 'Your password should be at least {{ limit }} characters',
                            'max' => 4096,
                        ]),
                    ],
                ],
                'second_options' => [
                    'attr' => [
                        'class' => 'form-control',
                        'placeholder' => 'Confirm password'
                    ],
                    'label' => 'Confirm Password',
                ],
                'invalid_message' => 'The password fields must match.',
            ]);
        }
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => User::class,
            'is_edit' => false,
            'is_department_head' => false,
            'csrf_protection' => true,
        ]);
    }
}