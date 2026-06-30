import { SecretMeta } from '@playwright-platform/shared-types';

type SecretWithEnvironment = {
  id: string;
  projectId: string;
  environmentId: string | null;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  environment: { name: string } | null;
};

export function toSecretMeta(secret: SecretWithEnvironment): SecretMeta {
  return {
    id: secret.id,
    projectId: secret.projectId,
    environmentId: secret.environmentId ?? undefined,
    environmentName: secret.environment?.name,
    name: secret.name,
    createdAt: secret.createdAt.toISOString(),
    updatedAt: secret.updatedAt.toISOString(),
  };
}
