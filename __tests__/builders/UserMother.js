import { User } from '../../src/domain/User.js';

export class UserMother {
    static umUsuarioPadrao() {
        return new User(1, 'Carlos Silva', 'carlos@email.com', 'PADRAO');
    }

    static umUsuarioPremium() {
        return new User(2, 'Ana Souza', 'premium@email.com', 'PREMIUM');
    }
}
