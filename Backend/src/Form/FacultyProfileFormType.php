<?php

namespace App\Form;

use App\Entity\User;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\EmailType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\Email;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\Length;

class FacultyProfileFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('firstName', TextType::class, [
                'label' => 'First Name',
                'required' => true,
                'attr' => [
                    'class' => 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'placeholder' => 'Enter your first name'
                ],
                'constraints' => [
                    new NotBlank(['message' => 'First name is required']),
                    new Length(['min' => 2, 'max' => 255])
                ]
            ])
            ->add('middleName', TextType::class, [
                'label' => 'Middle Name',
                'required' => false,
                'attr' => [
                    'class' => 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'placeholder' => 'Optional'
                ]
            ])
            ->add('lastName', TextType::class, [
                'label' => 'Last Name',
                'required' => true,
                'attr' => [
                    'class' => 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'placeholder' => 'Enter your last name'
                ],
                'constraints' => [
                    new NotBlank(['message' => 'Last name is required']),
                    new Length(['min' => 2, 'max' => 255])
                ]
            ])
            ->add('email', EmailType::class, [
                'label' => 'Email Address',
                'required' => true,
                'attr' => [
                    'class' => 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'placeholder' => 'Enter your email address'
                ],
                'constraints' => [
                    new NotBlank(['message' => 'Email is required']),
                    new Email(['message' => 'Please enter a valid email address'])
                ]
            ])
            ->add('address', TextareaType::class, [
                'label' => 'Address',
                'required' => false,
                'attr' => [
                    'class' => 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'rows' => 3,
                    'placeholder' => 'Enter your complete address'
                ]
            ])
            ->add('position', TextType::class, [
                'label' => 'Position',
                'required' => false,
                'attr' => [
                    'class' => 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'placeholder' => 'e.g., Associate Professor, Instructor'
                ]
            ])
            ->add('otherDesignation', TextareaType::class, [
                'label' => 'Other Designation/Special Assignments',
                'required' => false,
                'attr' => [
                    'class' => 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'rows' => 3,
                    'placeholder' => 'e.g., Program Coordinator, Research Lead, Committee Member'
                ]
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => User::class,
        ]);
    }
}
