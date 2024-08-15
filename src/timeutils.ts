export function centisecondsToTime(centiseconds: number): string {
    if (centiseconds === -1) {
        return 'DNF';
    }

    centiseconds = Math.floor(centiseconds);
    const minutes = Math.floor(centiseconds / 6000);
    centiseconds %= 6000;
    const seconds = Math.floor(centiseconds / 100);
    centiseconds %= 100;

    const padCentiseconds = String(centiseconds).padStart(2, '0')
    const padseconds = String(seconds).padStart(2, '0')

    if (minutes > 0) {
        return `${minutes}:${padseconds}.${padCentiseconds}`;
    } 
    if (seconds > 0) {
        return `${seconds}.${padCentiseconds}`;
    }

    return `0.${padCentiseconds}`;
}

export function timeToCentiseconds(time: string): number {

    if (time.toLowerCase() === 'dnf') {
        return -1;
    }
    let minutes = 0;
    if (time.includes(':')) {
        minutes = parseInt(time.split(':')[0] ?? "0");
    }
    
	time = time.split(':')[1] ?? time;

    return minutes * 6000 + Math.floor(parseFloat(time) * 100) 
}


export function isValidTime(time: string): boolean{
    //checks if a time can be converted to centiseconds and back to time foramt
    return timeToCentiseconds(centisecondsToTime(timeToCentiseconds(time))) === timeToCentiseconds(time);
}

export function wcaAverage(times: number[]):number {
    const sum = (arr: number[]): number => arr.reduce((acc, curr) => acc + curr, 0);

    times = times.slice(0, 5);

    if (times.filter(time => time === -1).length > 1) {
        return -1;
    }

    times = times.map(time => time === -1 ? 999999 : time);
    
    return (sum(times)-Math.max(...times)-Math.min(...times))/3;
}

export function bpa(times: number[]) {
    const sum = (arr: number[]): number => arr.reduce((acc, curr) => acc + curr, 0);

    times = times.slice(0, 4);
    if (times.filter(i => i === -1).length > 1) {
        return -1;
    }

    times = times.map(time => time === -1 ? 999999 : time);
    return (sum(times)-Math.max(...times))/3;
}

export function wpa(times: number[]) {
    const sum = (arr: number[]): number => arr.reduce((acc, curr) => acc + curr, 0);
    times = times.slice(0, 4);
    if (times.filter(i => i === -1).length > 0) {
        return -1;
    }

    return (sum(times)-Math.min(...times))/3;
}

export function mean(times: number[]) {
    const sum = (arr: number[]): number => arr.reduce((acc, curr) => acc + curr, 0);
    if (times.includes(-1)) {
        return -1;
    }

    return sum(times)/times.length
}