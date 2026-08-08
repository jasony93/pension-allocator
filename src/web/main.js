import { mountApp } from './ui/app.js';
import * as engineClient from './engine/engine-client.js';
import { createAnalytics, deviceType, utmFromLocation } from './analytics.js';

const analytics = createAnalytics();

// page_view는 판정 지표에 쓰이지 않는 운영 모니터링용 이벤트다
// (analytics-plan.md 4-2절). 개인 식별 가능 값은 담지 않는다.
analytics.track('page_view', { ...utmFromLocation(window.location), device_type: deviceType() });

const root = document.getElementById('app');
mountApp(root, { engineClient, analytics });
