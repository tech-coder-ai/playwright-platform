import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import Chart, { ChartConfiguration } from 'chart.js/auto';

@Component({
  selector: 'app-chart-panel',
  template: `
    @if (emptyMessage && isEmpty) {
      <p class="empty">{{ emptyMessage }}</p>
    } @else {
      <div class="chart-wrap" [style.height]="height"><canvas #canvas></canvas></div>
    }
  `,
  styles: `
    .chart-wrap {
      position: relative;
    }

    .empty {
      color: #64748b;
      font-size: 0.875rem;
      margin: 2rem 0;
      text-align: center;
    }
  `,
})
export class ChartPanelComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) config!: ChartConfiguration;
  @Input() emptyMessage?: string;
  @Input() isEmpty = false;
  @Input() height = '16rem';

  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private viewReady = false;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    this.viewReady = true;
    this.render();
  }

  ngOnChanges() {
    if (this.isEmpty) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }
    queueMicrotask(() => this.render());
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  private render() {
    if (!this.viewReady || this.isEmpty || !this.canvasRef) return;

    requestAnimationFrame(() => {
      if (!this.canvasRef) return;
      this.chart?.destroy();
      this.chart = new Chart(this.canvasRef.nativeElement, this.config);
      this.cdr.detectChanges();
    });
  }
}
