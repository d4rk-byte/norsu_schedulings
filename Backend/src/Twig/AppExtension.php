<?php

namespace App\Twig;

use App\Service\SystemSettingsService;
use Twig\Extension\AbstractExtension;
use Twig\Extension\GlobalsInterface;

class AppExtension extends AbstractExtension implements GlobalsInterface
{
    private SystemSettingsService $systemSettingsService;

    public function __construct(SystemSettingsService $systemSettingsService)
    {
        $this->systemSettingsService = $systemSettingsService;
    }

    public function getGlobals(): array
    {
        return [
            'hasActiveSemester' => $this->systemSettingsService->hasActiveSemester(),
            'activeSemesterDisplay' => $this->systemSettingsService->getActiveSemesterDisplay(),
        ];
    }
}
