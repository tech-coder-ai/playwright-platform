import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../crypto/encryption.service';
import { ensureProjectExists } from '../common/ensure-exists.util';
import { toSecretMeta } from './secrets.mapper';

@Injectable()
export class SecretsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async findByProject(projectId: string) {
    await ensureProjectExists(this.prisma, projectId);
    const secrets = await this.prisma.secret.findMany({
      where: { projectId },
      orderBy: [{ name: 'asc' }],
      include: { environment: { select: { name: true } } },
    });
    return secrets.map(toSecretMeta);
  }

  async findOne(id: string) {
    const secret = await this.prisma.secret.findUnique({
      where: { id },
      include: { environment: { select: { name: true } } },
    });
    if (!secret) {
      throw new NotFoundException(`Secret ${id} not found`);
    }
    return toSecretMeta(secret);
  }

  async create(
    projectId: string,
    data: { name: string; value: string; environmentId?: string },
  ) {
    await ensureProjectExists(this.prisma, projectId);
    await this.validateEnvironmentScope(projectId, data.environmentId);
    await this.ensureUniqueName(projectId, data.name, data.environmentId);

    if (!data.value.trim()) {
      throw new BadRequestException('Secret value is required');
    }

    const secret = await this.prisma.secret.create({
      data: {
        projectId,
        name: data.name.trim(),
        environmentId: data.environmentId ?? null,
        encryptedValue: this.encryption.encrypt(data.value),
      },
      include: { environment: { select: { name: true } } },
    });
    return toSecretMeta(secret);
  }

  async update(
    id: string,
    data: { name?: string; value?: string; environmentId?: string | null },
  ) {
    const existing = await this.prisma.secret.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Secret ${id} not found`);
    }

    const environmentId =
      data.environmentId !== undefined ? data.environmentId : existing.environmentId;
    const name = data.name?.trim() ?? existing.name;

    await this.validateEnvironmentScope(existing.projectId, environmentId ?? undefined);

    if (name !== existing.name || environmentId !== existing.environmentId) {
      await this.ensureUniqueName(existing.projectId, name, environmentId ?? undefined, id);
    }

    const secret = await this.prisma.secret.update({
      where: { id },
      data: {
        name,
        environmentId,
        encryptedValue:
          data.value !== undefined && data.value.length > 0
            ? this.encryption.encrypt(data.value)
            : undefined,
      },
      include: { environment: { select: { name: true } } },
    });
    return toSecretMeta(secret);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.secret.delete({ where: { id } });
  }

  /** Decrypted secrets for test-run injection — never expose via REST. */
  async resolveForRun(projectId: string, environmentId?: string): Promise<Record<string, string>> {
    const globalSecrets = await this.prisma.secret.findMany({
      where: { projectId, environmentId: null },
    });
    const envSecrets = environmentId
      ? await this.prisma.secret.findMany({ where: { projectId, environmentId } })
      : [];

    const resolved: Record<string, string> = {};
    for (const secret of globalSecrets) {
      resolved[secret.name] = this.encryption.decrypt(secret.encryptedValue);
    }
    for (const secret of envSecrets) {
      resolved[secret.name] = this.encryption.decrypt(secret.encryptedValue);
    }
    return resolved;
  }

  private async validateEnvironmentScope(projectId: string, environmentId?: string) {
    if (!environmentId) return;
    const environment = await this.prisma.environment.findFirst({
      where: { id: environmentId, projectId },
    });
    if (!environment) {
      throw new BadRequestException('Environment does not belong to this project');
    }
  }

  private async ensureUniqueName(
    projectId: string,
    name: string,
    environmentId?: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.secret.findFirst({
      where: {
        projectId,
        name,
        environmentId: environmentId ?? null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      const scope = environmentId ? 'this environment' : 'project-wide scope';
      throw new BadRequestException(`Secret "${name}" already exists in ${scope}`);
    }
  }
}
