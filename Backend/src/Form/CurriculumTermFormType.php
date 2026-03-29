<?php

namespace App\Form;

use App\Entity\CurriculumTerm;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\IntegerType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints as Assert;

class CurriculumTermFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('year_level', IntegerType::class, [
                'label' => 'Year Level',
                'attr' => [
                    'class' => 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500',
                    'min' => 1,
                    'max' => 6,
                    'placeholder' => 'Enter year level (1-6)'
                ],
                'constraints' => [
                    new Assert\NotBlank(['message' => 'Please enter a year level.']),
                    new Assert\Range([
                        'min' => 1,
                        'max' => 6,
                        'notInRangeMessage' => 'Year level must be between {{ min }} and {{ max }}.',
                    ])
                ],
            ])
            ->add('semester', ChoiceType::class, [
                'label' => 'Semester',
                'choices' => [
                    '1st Semester' => '1st',
                    '2nd Semester' => '2nd',
                    'Summer' => 'summer',
                ],
                'attr' => [
                    'class' => 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                ],
                'constraints' => [
                    new Assert\NotBlank(['message' => 'Please select a semester.']),
                ],
            ])
            ->add('term_name', TextType::class, [
                'label' => 'Custom Term Name (Optional)',
                'required' => false,
                'attr' => [
                    'class' => 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500',
                    'placeholder' => 'e.g., "Special Term", "Internship Period"'
                ],
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => CurriculumTerm::class,
        ]);
    }
}
