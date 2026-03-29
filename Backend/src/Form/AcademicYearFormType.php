<?php

namespace App\Form;

use App\Entity\AcademicYear;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints as Assert;

class AcademicYearFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('year', TextType::class, [
                'label' => 'Academic Year',
                'attr' => [
                    'placeholder' => 'e.g., 2024-2025',
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150',
                    'pattern' => '\d{4}-\d{4}',
                    'title' => 'Format: YYYY-YYYY (e.g., 2024-2025)'
                ],
                'constraints' => [
                    new Assert\NotBlank(message: 'Academic year is required'),
                    new Assert\Regex([
                        'pattern' => '/^\d{4}-\d{4}$/',
                        'message' => 'Academic year must be in format YYYY-YYYY (e.g., 2024-2025)'
                    ])
                ],
                'help' => 'Enter the academic year in format YYYY-YYYY (e.g., 2024-2025)'
            ])
            ->add('startDate', DateType::class, [
                'label' => 'Start Date',
                'widget' => 'single_text',
                'attr' => [
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150'
                ],
                'required' => false,
                'help' => 'When does this academic year start?'
            ])
            ->add('endDate', DateType::class, [
                'label' => 'End Date',
                'widget' => 'single_text',
                'attr' => [
                    'class' => 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150'
                ],
                'required' => false,
                'help' => 'When does this academic year end?'
            ])
            ->add('isCurrent', CheckboxType::class, [
                'label' => 'Set as Current Academic Year',
                'required' => false,
                'attr' => [
                    'class' => 'rounded text-blue-600 focus:ring-blue-500 focus:ring-2'
                ],
                'help' => 'Only one academic year can be current at a time'
            ])
            ->add('isActive', CheckboxType::class, [
                'label' => 'Active',
                'required' => false,
                'attr' => [
                    'class' => 'rounded text-blue-600 focus:ring-blue-500 focus:ring-2'
                ],
                'help' => 'Inactive academic years are hidden from selection lists'
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => AcademicYear::class,
        ]);
    }
}
