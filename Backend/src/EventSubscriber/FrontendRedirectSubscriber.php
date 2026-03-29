<?php

namespace App\EventSubscriber;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

class FrontendRedirectSubscriber implements EventSubscriberInterface
{
    public function __construct(
        #[Autowire('%app.frontend_base_url%')]
        private string $frontendBaseUrl
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            KernelEvents::REQUEST => ['onKernelRequest', 12],
        ];
    }

    public function onKernelRequest(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        if ($event->hasResponse()) {
            return;
        }

        $request = $event->getRequest();
        $path = $request->getPathInfo();

        if ($this->isExemptPath($path)) {
            return;
        }

        $baseUrl = rtrim($this->frontendBaseUrl, '/');
        if ($baseUrl === '') {
            return;
        }

        $target = $baseUrl . $path;
        $query = $request->getQueryString();
        if ($query !== null && $query !== '') {
            $target .= '?' . $query;
        }

        $event->setResponse(new RedirectResponse($target));
        $event->stopPropagation();
    }

    private function isExemptPath(string $path): bool
    {
        $exemptPrefixes = [
            '/api',
            '/health',
            '/_profiler',
            '/_wdt',
            '/images',
            '/build',
            '/bundles',
            '/css',
            '/js',
            '/vendor',
        ];

        foreach ($exemptPrefixes as $prefix) {
            if (str_starts_with($path, $prefix)) {
                return true;
            }
        }

        $exemptExact = [
            '/favicon.ico',
            '/robots.txt',
            '/sitemap.xml',
        ];

        return in_array($path, $exemptExact, true);
    }
}
