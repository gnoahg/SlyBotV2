/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { InteractionTypes, MessageComponentTypes } from "../typings/enum";
import { MessageInteractionAction } from "../typings";
import { ButtonInteraction, Collection, CommandInteraction, CommandInteractionOptionResolver, ContextMenuInteraction, GuildMember, Interaction, InteractionReplyOptions, Message, MessageActionRow, MessageButton, MessageMentions, MessageOptions, MessagePayload, SelectMenuInteraction, TextBasedChannels, User } from "discord.js";

export class CommandContext {
    public additionalArgs: Collection<string, any> = new Collection();
    public channel: TextBasedChannels|null = this.context.channel;
    public guild = this.context.guild;
    public constructor(public readonly context: Interaction|CommandInteraction|SelectMenuInteraction|ContextMenuInteraction|Message, public args: string[] = []) {}

    public async deferReply(): Promise<void> {
        if (this.isInteraction()) {
            return (this.context as CommandInteraction).deferReply();
        }
        return Promise.resolve(undefined);
    }

    public async reply(options: { askDeletion?: { reference: string } }|string|MessagePayload|MessageOptions|InteractionReplyOptions, autoedit?: boolean): Promise<Message> {
        if (this.isInteraction()) {
            if ((this.context as CommandInteraction).replied && !autoedit) throw new Error("Interaction already replied");
        }

        const context = this.context as Message|CommandInteraction;
        const rep = await this.send(options, this.isInteraction() ? ((context as Interaction).isCommand() ? ((context as CommandInteraction).replied ? "editReply" : "reply") : "reply") : "reply").catch(e => ({ error: e }));
        if (!rep || "error" in rep) throw new Error(`Unable to reply context. Reason: ${rep ? (rep.error as Error).message : "Unknown"}`);

        return (rep instanceof Message ? rep : new Message(this.context.client, rep));
    }

    public async send(options: { askDeletion?: { reference: string } }|string|MessagePayload|MessageOptions|InteractionReplyOptions, type: MessageInteractionAction = "editReply"): Promise<Message> {
        const deletionBtn = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setEmoji("🗑️")
                    .setStyle("DANGER")
            );
        if ((options as any).askDeletion) {
            deletionBtn.components[0].setCustomId(Buffer.from(`${(options as any).askDeletion.reference}_delete-msg`).toString("base64"));
            (options as InteractionReplyOptions).components ? (options as InteractionReplyOptions).components!.push(deletionBtn) : (options as InteractionReplyOptions).components = [deletionBtn];
        }
        if (this.isInteraction()) {
            (options as InteractionReplyOptions).fetchReply = true;
            const msg = await (this.context as CommandInteraction)[type](options as any) as Message;
            const channel = this.context.channel;
            const res = await channel!.messages.fetch(msg.id).catch(() => null);
            return res ?? msg;
        }
        if ((options as InteractionReplyOptions).ephemeral) {
            throw new Error("Cannot send ephemeral message in a non-interaction context");
        }
        return this.context.channel!.send(options as any);
    }


    public get mentions(): MessageMentions|null {
        return this.context instanceof Message ? this.context.mentions : null;
    }

    public get deferred(): boolean {
        return this.context instanceof Interaction ? (this.context as CommandInteraction).deferred : false;
    }

    public get options(): CommandInteractionOptionResolver|null {
        return this.context instanceof Interaction ? (this.context as CommandInteraction).options : null;
    }

    public get author(): User {
        return this.context instanceof Interaction ? this.context.user : this.context.author;
    }

    public get member(): GuildMember|null {
        return this.guild!.members.resolve(this.author.id);
    }

    public isInteraction(): boolean {
        return this.isCommand() || this.isContextMenu() || this.isMessageComponent() || this.isButton() || this.isSelectMenu();
    }

    public isCommand(): boolean {
        return InteractionTypes[(this.context as Interaction).type] === InteractionTypes.APPLICATION_COMMAND && typeof (this.context as any).targetId === "undefined";
    }

    public isContextMenu(): boolean {
        return InteractionTypes[(this.context as Interaction).type] === InteractionTypes.APPLICATION_COMMAND && typeof (this.context as any).targetId !== "undefined";
    }

    public isMessageComponent(): boolean {
        return InteractionTypes[(this.context as Interaction).type] === InteractionTypes.MESSAGE_COMPONENT;
    }

    public isButton(): boolean {
        return (
            InteractionTypes[(this.context as Interaction).type] === InteractionTypes.MESSAGE_COMPONENT &&
            MessageComponentTypes[(this.context as ButtonInteraction).componentType] === MessageComponentTypes.BUTTON
        );
    }

    public isSelectMenu(): boolean {
        return (
            InteractionTypes[(this.context as Interaction).type] === InteractionTypes.MESSAGE_COMPONENT &&
            MessageComponentTypes[(this.context as SelectMenuInteraction).componentType] === MessageComponentTypes.SELECT_MENU
        );
    }
}
