type CstimerEvent = [string, string, number];

type Competitors = {
    [id: string]: string;
};

type Times = {
    [id: string]: number[];
};

type CompInfo = {
    scrambles: string[];
    competitors: {[id: string]: string};
    times: Times;
    name: string;
    eventInfo: CstimerEvent;
};

export {CstimerEvent, CompInfo, Competitors, Times};