import { Module } from '@nestjs/common';
import { CodegenModule } from '../codegen/codegen.module';
import { PageObjectsController } from './page-objects.controller';
import { PageObjectsService } from './page-objects.service';
import { PageObjectGenerateService } from './page-object-generate.service';
import { PageObjectSaveService } from './page-object-save.service';

@Module({
  imports: [CodegenModule],
  controllers: [PageObjectsController],
  providers: [PageObjectsService, PageObjectGenerateService, PageObjectSaveService],
  exports: [PageObjectsService],
})
export class PageObjectsModule {}
