import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  catchError,
  Observable,
  of,
  throwError,
  Subject,
  tap,
  BehaviorSubject,
} from 'rxjs';
import { User } from '../models/user.model';
import { Router } from '@angular/router';

export interface AuthResponseData {
  idToken: string;
  email: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  registered?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private signUpUrl = environment.signUpUrl;
  private sigInUrl = environment.signInUrl;
  private tokenExpirationTimer: any;
  user = new BehaviorSubject<User>(null);
  // behaviorSubject é um Subject que permite que o último valor seja retornado sempre que o observable for chamado
  // então mesmo não ter inscrito no observable no momento que o valor foi passado, o último valor será retornado

  constructor(private http: HttpClient, private router: Router) {}

  signUp(email: string, password: string): Observable<AuthResponseData> {
    return this.http
      .post<AuthResponseData>(this.signUpUrl, {
        email: email,
        password: password,
        returnSecureToken: true,
      })
      .pipe(
        catchError(this.handleError),
        tap({
          next: (res) => {
            this.handleAuthentification(
              res.email,
              res.localId,
              res.idToken,
              +res.expiresIn
            );
          },
        })
      );
  }

  login(email: string, password: string): Observable<AuthResponseData> {
    return this.http
      .post<AuthResponseData>(this.sigInUrl, {
        email: email,
        password: password,
        returnSecureToken: true,
      })
      .pipe(
        catchError(this.handleError),
        tap({
          next: (res) => {
            this.handleAuthentification(
              res.email,
              res.localId,
              res.idToken,
              +res.expiresIn
            );
          },
        })
      );
  }

  autoLogin() {
    const userData: {
      email: string;
      id: string;
      _token: string;
      _tokenExpirationDate: string;
    } = JSON.parse(localStorage.getItem('userData'));
    if (!userData) {
      return;
    }

    const loadedUser = new User(
      userData.email,
      userData.id,
      userData._token,
      new Date(userData._tokenExpirationDate)
    );

    if (loadedUser.token) {
      this.user.next(loadedUser);
      const expirationDuration =
        new Date(userData._tokenExpirationDate).getTime() -
        new Date().getTime();
      this.autoLogout(expirationDuration);
    }
  }

  logout() {
    this.user.next(null);
    this.router.navigate(['/auth']);
    localStorage.removeItem('userData');
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
    }
    this.tokenExpirationTimer = null;
  }

  autoLogout(expirationDuration: number) {
    this.tokenExpirationTimer = setTimeout(() => {
      this.logout();
    }, expirationDuration);
  }

  private handleAuthentification(
    email: string,
    userId: string,
    token: string,
    expiresIn: number
  ) {
    const expirationDate = new Date(new Date().getTime() + +expiresIn * 1000);
    const user = new User(email, userId, token, expirationDate);
    this.user.next(user);
    this.autoLogout(expiresIn * 1000);
    localStorage.setItem('userData', JSON.stringify(user));
  }

  private handleError(err: HttpErrorResponse): Observable<any> {
    let errorMessage =
      'Ocorreu um erro desconhecido, tente novamente mais tarde!';
    if (!err.error || !err.error.error) {
      return throwError(() => new Error(errorMessage));
    }
    switch (err.error.error.message) {
      case 'EMAIL_EXISTS':
        errorMessage =
          'O endereço de e-mail já está sendo usado por outra conta';
        break;
      case 'OPERATION_NOT_ALLOWED':
        errorMessage = 'O login por senha está desabilitado para este projeto.';
        break;
      case 'TOO_MANY_ATTEMPTS_TRY_LATER':
        errorMessage =
          'Bloqueamos todas as solicitações deste dispositivo devido a atividades incomuns. Tente mais tarde.';
        break;
      case 'EMAIL_NOT_FOUND':
        errorMessage =
          'Não há registro de usuário correspondente a este identificador. O usuário pode ter sido excluído.';
        break;
      case 'INVALID_PASSWORD':
        errorMessage = 'A senha é inválida ou o usuário não possui senha.';
        break;
      case 'USER_DISABLED':
        errorMessage =
          'A conta de usuário foi desabilitada por um administrador.';
        break;
    }
    return throwError(() => new Error(errorMessage));
  }
}
