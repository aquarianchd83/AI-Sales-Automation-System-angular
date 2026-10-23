import { Directive, ElementRef, EventEmitter, NgZone, OnDestroy, OnInit, Output } from '@angular/core';

/**
 * Emits whenever the element scrolls into view - and again after each emit while it is still in view, so a list that
 * reveals one more page per emit keeps going until the element is pushed off screen. Put it on a marker just below
 * the last row of a list to load the next rows as the user reaches the bottom.
 */
@Directive({ selector: '[appInViewport]' })
export class InViewportDirective implements OnInit, OnDestroy {
  @Output() appInViewport = new EventEmitter<void>();

  private observer?: IntersectionObserver;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private readonly element: ElementRef<HTMLElement>, private readonly zone: NgZone) {}

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) {
          return;
        }
        this.zone.run(() => this.appInViewport.emit());
        // Look again once the new rows are in: if the marker is still on screen, more are wanted.
        this.timer = setTimeout(() => {
          this.observer?.unobserve(this.element.nativeElement);
          this.observer?.observe(this.element.nativeElement);
        }, 50);
      });
      this.observer.observe(this.element.nativeElement);
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.observer?.disconnect();
  }
}
