import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, CacheType, ChatInputCommandInteraction, EmbedBuilder, MessageComponentInteraction, ModalBuilder, ModalSubmitInteraction, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, UserSelectMenuInteraction } from 'discord.js';

import cstimer from 'cstimer_module'
import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';

import { davisGold } from '../constants/bot-config.js';
import { commandData } from '../utilities.js';
import { centisecondsToTime, timeToCentiseconds, bpa, wcaAverage, mean, wpa, isValidTime } from '../timeutils.js'
import { CstimerEvent, CompInfo, Competitors, Times } from '../custom-types.js';
import { cstimerWcaEvents, eventChoices } from '../constants/constants.js';

export default {
    data: new SlashCommandBuilder()
        .setName('startcompsim')
        .setDescription('Create a new comp sim')
        .addStringOption(option => option.setName('event')
            .setDescription('Select a WCA Event')
            .setRequired(true)
            .addChoices(...eventChoices)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        //send user select menu
        const menu = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
            new UserSelectMenuBuilder()
            .setCustomId('selectusers')
            .setPlaceholder('Select competitors')
            .addDefaultUsers(interaction.user.id)
            .setMinValues(2)
            .setMaxValues(15)
        );
        const menuInteraction = await interaction.reply({ content: 'Select competitors', components: [menu] });

        //retreive the selected competitors
        let selectedUsers: string[];
        try {
            const menuMessage = await menuInteraction.awaitMessageComponent({ 
                filter: (i: MessageComponentInteraction) => i.user.id === interaction.user.id, time:300_000 
            }) as UserSelectMenuInteraction;

            selectedUsers = menuMessage.values;
            const menuReply = selectedUsers.map(id => `<@${id}>`).join(' ');
            await menuMessage.update({content:`You selected: ${menuReply}`, components: [] });
        } catch (error) {
            console.log("Didn't submit competitors")
            await interaction.editReply({ content: 'Selection not received, try again', components: [] });
            return;
        }

        //setup comp information
        const eventInfo = cstimerWcaEvents.find(event => event[1] === interaction.options.getString('event') as string) as CstimerEvent;
        const compInfo: CompInfo = {
            scrambles: [...Array(5)].map(() => cstimer.getScramble(eventInfo[1], eventInfo[2])),
            competitors: Object.fromEntries(selectedUsers.map(competitorId => 
                [competitorId, interaction.guild?.members.cache.get(competitorId)?.displayName ?? 'Unknown']
            )),
            times: Object.fromEntries(selectedUsers.map(user => [user, []])),
            name: "3x3Round1",
            eventInfo: eventInfo
        };

        let currentSolver = nextCompetitor(compInfo)

        //send embed and buttons
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('entertime').setLabel('Enter Time').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('skip').setLabel('Skip').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('edit').setLabel('Edit Time').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('export').setLabel('Export').setStyle(ButtonStyle.Secondary)
        );
        if (!interaction.channel) { return; }
        let embedMessage = await interaction.channel.send({
            embeds: [generateInfo(compInfo),(await generateScramble(compInfo, currentSolver))[0]],
            files: [(await generateScramble(compInfo, currentSolver))[1]],
            components: [row]
        });

        //handle skip button
        embedMessage.createMessageComponentCollector(
            { filter: i => i.customId === 'skip'}
        ).on('collect', async skipInteraction => {  
            let compInfoCopy: CompInfo = structuredClone(compInfo);
            delete compInfoCopy.times[currentSolver];
            if (nextCompetitor(compInfoCopy) !== 'none') { 
                currentSolver = nextCompetitor(compInfoCopy);
                await embedMessage.edit({
                    embeds: [generateInfo(compInfo),(await generateScramble(compInfo, currentSolver))[0]],
                    files: [(await generateScramble(compInfo, currentSolver))[1]]
                });
            }
            await skipInteraction.update({});
        });

        //handle export button
        embedMessage.createMessageComponentCollector(
            { filter: i => i.customId === 'export'}
        ).on('collect', async exportInteraction => {
            await exportInteraction.reply({content: JSON.stringify(compInfo, null, 2), ephemeral: true});
        });

        //handle edit button
        embedMessage.createMessageComponentCollector(
            { filter: i => i.customId === 'edit'}
        ).on('collect', async editInteraction => {
            let key = Math.floor(1000000000 + Math.random() * 9000000000).toString()//not confuse with other instances

            //check permissions
            if (!selectedUsers.includes(editInteraction.user.id)) {
                editInteraction.reply({content: "Only competitors can edit times", ephemeral: true})
                setTimeout(() => { editInteraction.deleteReply() }, 5_000);
                return;
            }
            if (selectedUsers.filter(id => nextSolveIndex(compInfo, id) > 0).length === 0){
                editInteraction.reply({content: "No one has solved yet!", ephemeral: true})
                setTimeout(() => { editInteraction.deleteReply() }, 5_000);
                return; 
            }

            //send user select menu
            const userSelect = new StringSelectMenuBuilder().setCustomId('userselect').setPlaceholder('Select a Competitor');
            selectedUsers.filter(id => nextSolveIndex(compInfo, id) > 0).forEach((id) => {
                userSelect.addOptions(new StringSelectMenuOptionBuilder().setLabel(compInfo.competitors[id] as string).setValue(id));
            });
            const menu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(userSelect);
            const menuInteraction = await editInteraction.reply({components: [menu], ephemeral: true, fetchReply: true});

            //retreive the selected competitor
            let id: string;
            let menuMessage;
            try {
                menuMessage = await menuInteraction.awaitMessageComponent({ 
                    filter: (i: MessageComponentInteraction) => i.user.id === editInteraction.user.id, 
                    time: 100_000 
                }) as StringSelectMenuInteraction;
                id = menuMessage.values[0] as string;
                editInteraction.deleteReply()
            } catch (error) {
                //if competitor not selected
                console.log("ERROR: Selected competitor not received")
                await editInteraction.editReply({ content: 'Competitor not selected, try again', components: [] });
                setTimeout(() => { editInteraction.deleteReply() }, 5_000);
                return;
            } 

            //send modal
            const solveNumberInput = new TextInputBuilder()
                .setCustomId('solvenumber')
                .setLabel(`Enter Solve Number between 1 and ${nextSolveIndex(compInfo, id)}`)
                .setStyle(TextInputStyle.Short);
            const timeInput = new TextInputBuilder()
                .setCustomId('timeinput')
                .setLabel("Enter New Time")
                .setStyle(TextInputStyle.Short);
            const timeModal = new ModalBuilder()
                .setCustomId(key)
                .setTitle(`Enter Info for ${nameFromId(compInfo,id)}`)
                .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(solveNumberInput))
                .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput));

            await menuMessage.showModal(timeModal);

            //retreive modal entry
            let modalResponse: ModalSubmitInteraction;
            try {
                modalResponse = await menuMessage.awaitModalSubmit({ 
                    filter: (i: ModalSubmitInteraction) => i.customId===key, 
                    time: 100_000 });
            } catch (error) {
                console.log("ERROR: solve info not received")
                return;
            }

            const numberInput = modalResponse.fields.getTextInputValue('solvenumber');
            const time = modalResponse.fields.getTextInputValue('timeinput');
            if (!isValidTime(time)) {
                await modalResponse.reply({content: `This format (${time}) is not supported.`, ephemeral: true});
                setTimeout(() => { modalResponse.deleteReply() }, 5_000);
                return;
            }
            if (isNaN(+numberInput) || !Number.isInteger(+numberInput) || +numberInput < 1 || +numberInput > nextSolveIndex(compInfo, id)) {
                await modalResponse.reply({content: `Please enter a solve number between 1 and ${nextSolveIndex(compInfo, id)}`, ephemeral: true});
                setTimeout(() => { modalResponse.deleteReply() }, 5_000);
                return;
            }
            const solveNumber = +numberInput;
            (compInfo.times[id] as number[])[solveNumber-1] = timeToCentiseconds(time)
            await embedMessage.edit({
                embeds: [generateInfo(compInfo),(await generateScramble(compInfo, currentSolver))[0]],
                files: [(await generateScramble(compInfo, currentSolver))[1]]
            });
            modalResponse.deferUpdate();
        }); 

        //handle enter time button
        const enterTimeCollector = embedMessage.createMessageComponentCollector({ filter: i => 
            i.customId === 'entertime' && selectedUsers.includes(i.user.id) 
        });
        enterTimeCollector.on('collect', async timeInteraction => {
            const key = Math.floor(1000000000 + Math.random() * 9000000000).toString()
            //send modal
            const inputRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder().setCustomId('timeinput').setLabel("Time").setStyle(TextInputStyle.Short)
            );
            const timeModal = new ModalBuilder()
                .setCustomId(key)
                .setTitle(`Enter time for ${nameFromId(compInfo,currentSolver)}`)
                .addComponents(inputRow);
            await timeInteraction.showModal(timeModal);

            // retreive time from modal 
            try {
                const modalResponse = await timeInteraction.awaitModalSubmit({ 
                    filter: (i: ModalSubmitInteraction) => i.customId===key && Object.keys(compInfo.competitors).includes(i.user.id), 
                    time: 50_000 });
                const time = modalResponse.fields.getTextInputValue('timeinput');
                
                if (!isValidTime(time)) {
                    await modalResponse.reply({content: `This format (${time}) is not supported.`, ephemeral: true});
                    setTimeout(() => { modalResponse.deleteReply() }, 5_000);
                    return;
                }
                (compInfo.times[currentSolver] as number[]).push(timeToCentiseconds(time))

                //check if comp sim is over
                if (nextCompetitor(compInfo) == "none")  {
                    embedMessage.edit({embeds: [generateInfo(compInfo), generateStatistics(compInfo)] , components: [], files: []});
                    await modalResponse.deferUpdate();
                    return;
                };
                currentSolver = nextCompetitor(compInfo);
                await embedMessage.edit({
                    embeds: [generateInfo(compInfo),(await generateScramble(compInfo, currentSolver))[0]],
                    files: [(await generateScramble(compInfo, currentSolver))[1]]
                });
                await modalResponse.deferUpdate();
            } catch (error) {
                console.error(error);
                return;
            }   
        });
    }
} as commandData;


function nextSolveIndex(compInfo: CompInfo, currentSolver: string):number {
    const timesArray = compInfo.times[currentSolver] as number[];
    return timesArray.length;
}

function nameFromId(compInfo: CompInfo, id: string): string {
     return compInfo.competitors[id] as string
}

function nextCompetitor(compInfo: CompInfo): string {
    let shortestIndex = 5;
    let shortestUserId: string | null = null;
    Object.keys(compInfo.times).forEach(id => {
        const timesArray = compInfo.times[id] as number[];
        if (nextSolveIndex(compInfo, id) < shortestIndex) {
            shortestIndex = nextSolveIndex(compInfo, id);
            shortestUserId = id;
        }
    });

    return shortestUserId ?? "none";
}

async function generateScramble(compInfo: CompInfo, currentSolver: string): Promise<[EmbedBuilder, AttachmentBuilder]> {
    let scramble = compInfo.scrambles[nextSolveIndex(compInfo,currentSolver)] as string;
    let scrambleImage = cstimer.getImage(scramble, compInfo.eventInfo[1]);

    // convert image to png
    const buffer = Buffer.from(scrambleImage, "utf-8")
    const resvg = new Resvg(buffer)
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()
    const img = await loadImage(pngBuffer);
    const desiredWidth = 200;
    const desiredHeight = (img.height / img.width) * desiredWidth;  // Maintain aspect ratio
    const canvas = createCanvas(desiredWidth, desiredHeight);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, desiredWidth, desiredHeight);
    const resizedPngBuffer = canvas.toBuffer();

    const attachment = new AttachmentBuilder(resizedPngBuffer, { name: 'scramble-image.png' });
    
    const scrambleEmbed = new EmbedBuilder()
        .setTitle("Next Competitor")
        .setColor(davisGold)
        .setImage(`attachment://${attachment.name}`)
        .addFields(
            { name: `Name:`, value:` <@${currentSolver}>`},
            { name: `Scramble:`, value:`${scramble}`},
        )
    
    return [scrambleEmbed,attachment];

}

function generateInfo(compInfo: CompInfo) {
    const timesEmbed = new EmbedBuilder()
        .setTitle("Results: " + compInfo.eventInfo[0])
        .setColor(davisGold)

    //add the times for each competitor to the embed
    Object.entries(compInfo.times).forEach(([id ,times]) => {
        let stat;
        let solveIndex = nextSolveIndex(compInfo,id)
        if (solveIndex === 4) {
            stat = ` (bpa ${centisecondsToTime(bpa(times))} wpa ${centisecondsToTime(wpa(times))})`;
        } else if (solveIndex === 5) {
            stat = ` (avg ${centisecondsToTime(wcaAverage(times))})`;
        } else if (solveIndex === 0) {
            stat = '';
        } else {
            stat = ` (mean ${centisecondsToTime(mean(times))})`;
        }

        timesEmbed.addFields(
            {name:`${nameFromId(compInfo,id)} ${stat}`, 
            value: times.map(time => centisecondsToTime(time)).join('  ') + "\n" + '\u200B'}
        )
    });
    return timesEmbed
}

function generateStatistics(compInfo: CompInfo) {
    let ranking = Object.keys(compInfo.times).sort((id1, id2) => 
        mean(compInfo.times[id1] as number[]) - mean(compInfo.times[id2] as number[])
    );

    let rankingString = ranking.map(id => 
        `${nameFromId(compInfo, id)} ${centisecondsToTime(mean(compInfo.times[id] as number[]))}`
    ).join('\n');

    const rankingEmbed = new EmbedBuilder()
        .setTitle("Rankings: " + compInfo.eventInfo[0])
        .setColor(davisGold)
        .addFields( { name: '\u200B', value: rankingString } );

    return rankingEmbed
}