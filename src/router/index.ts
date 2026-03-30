import { createRouter, createWebHashHistory } from 'vue-router';
import WelcomePage from '@/pages/WelcomePage.vue';
import PlayPage from '@/pages/PlayPage.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: WelcomePage },
    { path: '/play', component: PlayPage },
  ],
});

export default router;
