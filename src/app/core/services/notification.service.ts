import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private readonly snackBar: MatSnackBar) {}

  success(message: string): void {
    this.open(message, 'snack-success', 3000);
  }

  error(message: string): void {
    this.open(message, 'snack-error', 6000);
  }

  info(message: string): void {
    this.open(message, 'snack-info', 4000);
  }

  private open(message: string, panelClass: string, duration: number): void {
    this.snackBar.open(message, 'Dismiss', {
      duration,
      panelClass: [panelClass],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }
}
