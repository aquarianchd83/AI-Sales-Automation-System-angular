import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TestChatReply, TestChatTurn } from '../models/product-test-chat.model';

/** Talk to the AI as a customer would, answered only from the live published product knowledge (tenant Admin only). Nothing is stored or sent. */
@Injectable({ providedIn: 'root' })
export class ProductTestChatService {
  private readonly url = `${environment.apiBaseUrl}/product-knowledge/test-chat`;

  constructor(private readonly http: HttpClient) {}

  ask(message: string, history: TestChatTurn[]): Observable<TestChatReply> {
    return this.http.post<TestChatReply>(this.url, { message, history });
  }
}
