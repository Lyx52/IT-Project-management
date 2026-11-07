import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Messenger } from './messenger';

describe('Messenger', () => {
  let component: Messenger;
  let fixture: ComponentFixture<Messenger>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Messenger],
    }).compileComponents();

    fixture = TestBed.createComponent(Messenger);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
