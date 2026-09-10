import { Component, OnInit } from '@angular/core';

import { PlatformWhatsAppConnection } from '../../../core/models/platform.model';
import { PlatformWhatsAppConnectionService } from '../../../core/services/platform-whatsapp-connection.service';

@Component({
  selector: 'app-platform-whatsapp-connections',
  templateUrl: './platform-whatsapp-connections.component.html',
  styleUrls: ['./platform-whatsapp-connections.component.scss'],
})
export class PlatformWhatsAppConnectionsComponent implements OnInit {
  readonly displayedColumns = ['tenant', 'phoneNumberId', 'status', 'webhooks', 'updatedAt'];

  connections: PlatformWhatsAppConnection[] = [];
  loading = true;

  constructor(private readonly connectionService: PlatformWhatsAppConnectionService) {}

  ngOnInit(): void {
    this.connectionService.getAll().subscribe({
      next: (connections) => {
        this.connections = connections;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }
}
