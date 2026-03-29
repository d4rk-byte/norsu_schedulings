<?php

namespace App\Form;

use App\Entity\College;
use App\Entity\Department;
use App\Entity\User;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\EmailType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints as Assert;

class DepartmentFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('code', TextType::class, [
                'label' => 'Department Code',
                'attr' => [
                    'placeholder' => 'e.g., CS, IT, MATH',
                    'maxlength' => 10
                ],
                'constraints' => [
                    new Assert\NotBlank(['message' => 'Department code is required']),
                    new Assert\Length([
                        'max' => 10,
                        'maxMessage' => 'Department code cannot be longer than {{ limit }} characters'
                    ]),
                    new Assert\Regex([
                        'pattern' => '/^[A-Z0-9-]+$/',
                        'message' => 'Department code can only contain uppercase letters, numbers, and hyphens'
                    ])
                ]
            ])
            ->add('name', TextType::class, [
                'label' => 'Department Name',
                'attr' => [
                    'placeholder' => 'e.g., Computer Science'
                ],
                'constraints' => [
                    new Assert\NotBlank(['message' => 'Department name is required']),
                    new Assert\Length([
                        'max' => 255,
                        'maxMessage' => 'Department name cannot be longer than {{ limit }} characters'
                    ])
                ]
            ])
            ->add('description', TextareaType::class, [
                'label' => 'Description',
                'required' => false,
                'attr' => [
                    'placeholder' => 'Enter department description (optional)',
                    'rows' => 4
                ]
            ])
            ->add('college', EntityType::class, [
                'class' => College::class,
                'choice_label' => 'name',
                'label' => 'College',
                'required' => true,
                'placeholder' => 'Select College',
                'constraints' => [
                    new Assert\NotBlank(['message' => 'College is required'])
                ],
                'query_builder' => function ($repository) {
                    return $repository->createQueryBuilder('c')
                        ->where('c.deletedAt IS NULL')
                        ->andWhere('c.isActive = :active')
                        ->setParameter('active', true)
                        ->orderBy('c.name', 'ASC');
                }
            ])
            ->add('head', EntityType::class, [
                'class' => User::class,
                'choice_label' => function (User $user) {
                    $name = trim(($user->getFirstname() ?? '') . ' ' . ($user->getLastname() ?? ''));
                    return $name ?: $user->getUsername();
                },
                'label' => 'Department Head',
                'required' => false,
                'placeholder' => 'Select Department Head (Optional)',
                'query_builder' => function ($repository) {
                    return $repository->createQueryBuilder('u')
                        ->where('u.deletedAt IS NULL')
                        ->andWhere('u.isActive = :active')
                        ->setParameter('active', true)
                        ->orderBy('u.lastName', 'ASC')
                        ->addOrderBy('u.firstName', 'ASC');
                },
            ])
            ->add('contactEmail', EmailType::class, [
                'label' => 'Contact Email',
                'required' => false,
                'attr' => [
                    'placeholder' => 'e.g., cs.dept@university.edu (Optional)'
                ],
                'constraints' => [
                    new Assert\Email(['message' => 'Please enter a valid email address']),
                    new Assert\Length([
                        'max' => 255,
                        'maxMessage' => 'Contact email cannot be longer than {{ limit }} characters'
                    ])
                ]
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => Department::class,
        ]);
    }
}
