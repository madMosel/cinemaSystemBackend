export interface Login {
    username: string,
    password: string,
    type: UserType,
    token: string
}

export enum UserType {
    ADMIN = "ADMIN",
    USER = "USER"
}
