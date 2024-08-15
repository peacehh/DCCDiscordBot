import { CstimerEvent } from "../custom-types";

const eventChoices: { name: string; value: string; }[] = [
    { "name": "3x3x3", "value": "333" }, 
    { "name": "2x2x2", "value": "222so" },
    { "name": "4x4x4", "value": "444wca" }, 
    { "name": "5x5x5", "value": "555wca" },
    { "name": "6x6x6", "value": "666wca" }, 
    { "name": "7x7x7", "value": "777wca" },
    { "name": "3x3 bld", "value": "333ni" }, 
    { "name": "3x3 fm", "value": "333fm" },
    { "name": "3x3 oh", "value": "333" }, 
    { "name": "clock", "value": "clkwca" },
    { "name": "megaminx", "value": "mgmp" }, 
    { "name": "pyraminx", "value": "pyrso" },
    { "name": "skewb", "value": "skbso" }, 
    { "name": "sq1", "value": "sqrs" },
    { "name": "4x4 bld", "value": "444bld" }, 
    { "name": "5x5 bld", "value": "555bld" }
]


const cstimerWcaEvents: CstimerEvent[] = [		
    ['3x3x3', "333", 0],
    ['2x2x2', "222so", 0],
    ['4x4x4', "444wca", 40],
    ['5x5x5', "555wca", 60],
    ['6x6x6', "666wca", 80],
    ['7x7x7', "777wca", 100],
    ['3x3 bld', "333ni", 0],
    ['3x3 fm', "333fm", 0],
    ['3x3 oh', "333", 0],
    ['clock', "clkwca", 0],
    ['megaminx', "mgmp", 70],
    ['pyraminx', "pyrso", 10],
    ['skewb', "skbso", 0],
    ['sq1', "sqrs", 0],
    ['4x4 bld', "444bld", 40],
    ['5x5 bld', "555bld", 60],
]
export {eventChoices, cstimerWcaEvents}