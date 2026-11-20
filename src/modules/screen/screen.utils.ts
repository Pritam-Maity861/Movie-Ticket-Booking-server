import { SeatType } from "../../generated/prisma/client";

export function getSeatTypeByRow(row: string): SeatType {
  const char = row.trim().toUpperCase().charCodeAt(0);
  if (char >= 65 && char <= 66) return "PREMIUM"; // A-B
  if (char >= 67 && char <= 69) return "VIP";     // C-E
  return "REGULAR";                               // F+
}

export function generateSeatGrid(
  screenId: string,
  totalSeats: number = 100,
  customRows?: string[],
  customSeatsPerRow?: number,
): Array<{
  screenId: string;
  row: string;
  number: number;
  type: SeatType;
}> {
  const seats: Array<{
    screenId: string;
    row: string;
    number: number;
    type: SeatType;
  }> = [];

  // Case 1: Custom rows and seatsPerRow provided
  if (
    customRows &&
    Array.isArray(customRows) &&
    customRows.length > 0 &&
    customSeatsPerRow &&
    customSeatsPerRow > 0
  ) {
    for (const row of customRows) {
      const cleanRow = row.trim().toUpperCase();
      if (!cleanRow) continue;
      for (let num = 1; num <= customSeatsPerRow; num++) {
        seats.push({
          screenId,
          row: cleanRow,
          number: num,
          type: getSeatTypeByRow(cleanRow),
        });
      }
    }
    if (seats.length > 0) return seats;
  }

  // Case 2: Auto-compute rows and seatsPerRow from totalSeats
  const cap = Math.max(1, Math.min(totalSeats || 100, 1000));
  let seatsPerRow = 10;
  if (cap >= 20) {
    if (cap % 10 === 0) seatsPerRow = 10;
    else if (cap % 12 === 0) seatsPerRow = 12;
    else if (cap % 15 === 0) seatsPerRow = 15;
    else if (cap % 8 === 0) seatsPerRow = 8;
    else seatsPerRow = 10;
  } else {
    seatsPerRow = cap;
  }

  let remaining = cap;
  let rowIndex = 0;

  while (remaining > 0 && rowIndex < 26) {
    const rowChar = String.fromCharCode(65 + rowIndex); // A, B, C...
    const countThisRow = Math.min(seatsPerRow, remaining);
    for (let num = 1; num <= countThisRow; num++) {
      seats.push({
        screenId,
        row: rowChar,
        number: num,
        type: getSeatTypeByRow(rowChar),
      });
    }
    remaining -= countThisRow;
    rowIndex++;
  }

  return seats;
}

