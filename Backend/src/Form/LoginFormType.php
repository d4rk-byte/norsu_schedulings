<?php

namespace App\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\Extension\Core\Type\PasswordType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\IsTrue;
use Symfony\Component\Validator\Constraints\Length;
use Symfony\Component\Validator\Constraints\NotBlank;

class LoginFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('email', TextType::class, [
                'label' => 'Email or Username',
                'attr' => [
                    'class' => 'form-input',
                    'placeholder' => 'Enter your email or username',
                    'autocomplete' => 'username'
                ],
                'constraints' => [
                    new NotBlank([
                        'message' => 'Please enter your email or username',
                    ]),
                ],
            ])
            ->add('password', PasswordType::class, [
                'label' => 'Password',
                'attr' => [
                    'class' => 'form-input',
                    'placeholder' => 'Enter your password',
                    'autocomplete' => 'current-password'
                ],
                'constraints' => [
                    new NotBlank([
                        'message' => 'Please enter your password',
                    ]),
                ],
            ])
            ->add('_remember_me', CheckboxType::class, [
                'label' => 'Remember me',
                'mapped' => false,
                'required' => false,
                'attr' => [
                    'class' => 'form-checkbox'
                ]
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'csrf_protection' => true,
            'csrf_field_name' => '_token',
            'csrf_token_id' => 'authenticate',
        ]);
    }
}