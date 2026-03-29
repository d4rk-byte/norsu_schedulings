<?php

namespace App\Form;

use App\Entity\College;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\FileType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints as Assert;

class CollegeFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $isEdit = $options['is_edit'];

        $builder
            ->add('code', TextType::class, [
                'label' => 'College Code',
                'attr' => [
                    'class' => 'mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm',
                    'placeholder' => 'e.g., CAS, COE, CBA',
                    'maxlength' => 10,
                ],
                'constraints' => [
                    new Assert\Sequentially([
                        new Assert\NotBlank(['message' => 'College code is required']),
                        new Assert\Length([
                            'min' => 2,
                            'max' => 10,
                            'minMessage' => 'College code must be at least {{ limit }} characters',
                            'maxMessage' => 'College code cannot exceed {{ limit }} characters',
                        ]),
                        new Assert\Regex([
                            'pattern' => '/^[A-Z]+$/',
                            'message' => 'College code must contain only uppercase letters',
                        ]),
                    ]),
                ],
                'help' => 'Unique abbreviation for the college (2-10 uppercase letters)',
            ])
            ->add('name', TextType::class, [
                'label' => 'College Name',
                'attr' => [
                    'class' => 'mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm',
                    'placeholder' => 'e.g., College of Arts and Sciences',
                    'maxlength' => 255,
                ],
                'constraints' => [
                    new Assert\NotBlank(['message' => 'College name is required']),
                    new Assert\Length([
                        'min' => 3,
                        'max' => 255,
                        'minMessage' => 'College name must be at least {{ limit }} characters',
                        'maxMessage' => 'College name cannot exceed {{ limit }} characters',
                    ]),
                ],
                'help' => 'Full official name of the college',
            ])
            ->add('description', TextareaType::class, [
                'label' => 'Description',
                'required' => false,
                'attr' => [
                    'class' => 'mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm',
                    'placeholder' => 'Brief description of the college, its programs, and mission...',
                    'rows' => 4,
                ],
                'help' => 'Optional description of the college',
            ])
            ->add('dean', TextType::class, [
                'label' => 'Dean',
                'required' => false,
                'attr' => [
                    'class' => 'mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm',
                    'placeholder' => 'e.g., Dr. Juan Dela Cruz',
                    'maxlength' => 255,
                ],
                'help' => 'Name of the college dean',
            ])
            ->add('logoFile', FileType::class, [
                'label' => 'College Logo',
                'required' => false,
                'mapped' => false,
                'attr' => [
                    'class' => 'mt-1 block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none',
                    'accept' => 'image/*',
                ],
                'constraints' => [
                    new Assert\File([
                        'maxSize' => '2M',
                        'mimeTypes' => [
                            'image/jpeg',
                            'image/png',
                            'image/gif',
                            'image/webp',
                        ],
                        'mimeTypesMessage' => 'Please upload a valid image (JPEG, PNG, GIF, or WebP)',
                    ])
                ],
                'help' => 'Upload college logo (max 2MB, JPG/PNG/GIF/WebP)',
            ]);

        // Auto-uppercase the college code before validation
        $builder->addEventListener(FormEvents::PRE_SUBMIT, function (FormEvent $event) {
            $data = $event->getData();
            if (isset($data['code']) && is_string($data['code'])) {
                $data['code'] = strtoupper(trim($data['code']));
                $event->setData($data);
            }
        });
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => College::class,
            'is_edit' => false,
        ]);
    }
}
