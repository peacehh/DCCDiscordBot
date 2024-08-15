import { ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } from 'discord.js';

import { commandData } from '../utilities.js';
import { Resvg } from '@resvg/resvg-js';
import cstimer from 'cstimer_module'
import cstimerEvents from '../constants/cstimer-events.js'
import { davisGold } from '../constants/bot-config.js';
import { CstimerEvent } from '../custom-types.js';
import { cstimerWcaEvents, eventChoices } from '../constants/constants.js';

export default {
    data: new SlashCommandBuilder()
        .setName('scramble')
        .setDescription('Scramble!')
        .addStringOption(option => option.setName('event')
            .setDescription('Select a WCA Event')
            .setRequired(true)
            .addChoices(...eventChoices)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const eventID: string = interaction.options.getString('event') as string;
        const eventInfo = cstimerWcaEvents.find(event => event[1] === eventID) as CstimerEvent;

        // generate scramble
        var scramble = cstimer.getScramble(eventInfo[1], eventInfo[2]);

        // generate scramble image
        var scrambleImage = cstimer.getImage(scramble, eventInfo[1]);

        // convert image to png
        const buffer = Buffer.from(scrambleImage, "utf-8")
        const resvg = new Resvg(buffer)
        const pngData = resvg.render()
        const pngBuffer = pngData.asPng()
        const attachment = new AttachmentBuilder(pngBuffer, { name: 'scramble-image.png' });

        const scrambleEmbed = new EmbedBuilder()
	        .setColor(davisGold)
            .addFields({ name: `${eventInfo[0]} Scramble`, value: scramble})
            .setImage(`attachment://${attachment.name}`)

        await interaction.editReply({ 
            embeds: [scrambleEmbed], files: [attachment]
        });
    }
} as commandData;
