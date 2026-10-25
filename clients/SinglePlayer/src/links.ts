export const landingUrl = () =>
    import.meta.env.VITE_LANDING_URL || `${window.location.protocol}//${window.location.hostname}:8103`;

export const toLanding = () => window.location.replace(landingUrl());
