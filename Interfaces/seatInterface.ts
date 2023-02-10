import { CinemaHall } from "./cinemaHallInterface"
import { Movie } from "./movieInterface"
import { Schedule } from "./scheduleInterface"

export enum SeatCategory {
    Normal = "Normal",
    Premium = "Premium",
    Handicap = "Handicap"
}

export enum SeatState {
    FREE = "FREE",
    RESERVED = "RESERVED",
    BOOKED = "BOOKED",
}

export interface Seat {
    id: number,
    category: SeatCategory,
    state: SeatState,
    belongsToLocalUser? : boolean
}

export const dummySeat: Seat = {
    category: SeatCategory.Normal,
    state: SeatState.FREE
} as Seat
