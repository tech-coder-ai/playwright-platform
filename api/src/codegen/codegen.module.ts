import { Module } from '@nestjs/common';
import { CodegenController } from './codegen.controller';
import { CodegenGateway } from './codegen.gateway';
import { CodegenService } from './codegen.service';
import { CodegenGenerateService } from './codegen-generate.service';
import { CodegenSaveService } from './codegen-save.service';

@Module({
  controllers: [CodegenController],
  providers: [CodegenService, CodegenGateway, CodegenGenerateService, CodegenSaveService],
  exports: [CodegenService],
})
export class CodegenModule {}
