export const ROLES = {
  GEE_SUPER_ADMIN: 'gee_super_admin',
  GEE_RH_ADMIN: 'gee_rh_admin',
  GEE_FINANCE_ADMIN: 'gee_finance_admin',
  GEE_TECHNICAL_ADMIN: 'gee_technical_admin',
  BUREAU_SUPER_ADMIN: 'bureau_super_admin',
  BUREAU_RH_ADMIN: 'bureau_rh_admin',
  BUREAU_FINANCE_ADMIN: 'bureau_finance_admin',
  BUREAU_TECHNICAL_ADMIN: 'bureau_technical_admin',
  BUREAU_USER: 'bureau_user'
};

export const isGEE = role => role?.startsWith('gee_');
export const isBureau = role => role?.startsWith('bureau_');

export const isSuperAdmin = role =>
  [ROLES.GEE_SUPER_ADMIN, ROLES.BUREAU_SUPER_ADMIN].includes(role);

export const canManageUsers = role =>
  [ROLES.GEE_SUPER_ADMIN, ROLES.BUREAU_SUPER_ADMIN].includes(role);

export const canSubmitReport = role =>
  [ROLES.BUREAU_USER, ROLES.BUREAU_TECHNICAL_ADMIN, ROLES.BUREAU_SUPER_ADMIN].includes(role);

export const canBureauForwardReport = role =>
  [ROLES.BUREAU_TECHNICAL_ADMIN, ROLES.BUREAU_SUPER_ADMIN].includes(role);

export const canReviewReport = role =>
  [ROLES.GEE_TECHNICAL_ADMIN, ROLES.GEE_SUPER_ADMIN].includes(role);

export const canManageProjects = role =>
  [ROLES.BUREAU_SUPER_ADMIN, ROLES.GEE_SUPER_ADMIN, ROLES.BUREAU_TECHNICAL_ADMIN].includes(role);

export const canViewGEEDashboard = role => isGEE(role);
export const canViewBureauDashboard = role => isBureau(role);

export const ROLE_LABELS = {
  gee_super_admin: 'Super Admin GEE',
  gee_rh_admin: 'Admin RH — GEE',
  gee_finance_admin: 'Admin Finance — GEE',
  gee_technical_admin: 'Admin Technique — GEE',
  bureau_super_admin: 'Super Admin Bureau',
  bureau_rh_admin: 'Admin RH — Bureau',
  bureau_finance_admin: 'Admin Finance — Bureau',
  bureau_technical_admin: 'Admin Technique — Bureau',
  bureau_user: 'Utilisateur Bureau'
};

export const STATUS_LABELS = {
  draft: 'Brouillon',
  submitted: 'Soumis',
  bureau_approved: 'Transmis GEE',
  bureau_rejected: 'Renvoyé par le bureau',
  accepted: 'Accepté',
  rejected: 'Rejeté',
  non_soumis: 'Non soumis',
};

export const STATUS_COLORS = {
  draft: 'default',
  submitted: 'info',
  bureau_approved: 'warning',
  accepted: 'success',
  rejected: 'error',
  non_soumis: 'default',
  bureau_rejected: 'error',
};