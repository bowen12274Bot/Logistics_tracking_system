<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

const { t } = useI18n()
</script>

<template>
  <div class="home-page">
    <div class="hero-container">
      <div class="hero-content">
        <p class="eyebrow">{{ t('home.eyebrow') }}</p>
        <h1 class="hero-title">{{ t('home.title') }}</h1>
        <p class="hero-lede">{{ t('home.lede') }}</p>
      </div>

      <div class="action-cards">
        <!-- Map Card -->
        <RouterLink to="/map" class="action-card">
          <div class="card-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
          </div>
          <h3 class="card-title">{{ t('home.actions.map') }}</h3>
          <p class="card-desc">{{ t('home.actions.mapDesc') }}</p>
        </RouterLink>

        <!-- Track Card -->
        <RouterLink to="/track" class="action-card">
          <div class="card-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <h3 class="card-title">{{ t('home.actions.track') }}</h3>
          <p class="card-desc">{{ t('home.actions.trackDesc') }}</p>
        </RouterLink>

        <!-- Estimate Card -->
        <RouterLink to="/shipping/estimate" class="action-card">
          <div class="card-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <h3 class="card-title">{{ t('home.actions.estimate') }}</h3>
          <p class="card-desc">{{ t('home.actions.estimateDesc') }}</p>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 75vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  position: relative;
}

.home-page::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #fff9f4 0%, #faeee7 100%);
  z-index: -1;
}

.hero-container {
  max-width: 1000px;
  width: 100%;
  text-align: center;
}

.hero-content {
  margin-bottom: 56px;
}

.eyebrow {
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 16px;
}

.hero-title {
  font-family: 'Outfit', sans-serif;
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  font-weight: 800;
  color: var(--text-main);
  line-height: 1.2;
  margin-bottom: 20px;
}

.hero-lede {
  font-family: 'Inter', sans-serif;
  font-size: 1.125rem;
  color: var(--text-muted);
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}

.action-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.action-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(165, 122, 99, 0.15);
  border-radius: 16px;
  padding: 32px 24px;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.action-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 25px -5px rgba(63, 38, 32, 0.1), 
              0 10px 10px -5px rgba(63, 38, 32, 0.04);
  border-color: rgba(244, 182, 194, 0.4);
  background: rgba(255, 255, 255, 0.95);
}

.card-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(244, 182, 194, 0.2) 0%, rgba(244, 182, 194, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  color: var(--accent);
  transition: transform 0.3s;
}

.action-card:hover .card-icon {
  transform: scale(1.1);
}

.card-title {
  font-family: 'Outfit', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 8px;
}

.card-desc {
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}

@media (max-width: 768px) {
  .home-page {
    padding: 32px 16px;
  }

  .hero-content {
    margin-bottom: 40px;
  }

  .action-cards {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
