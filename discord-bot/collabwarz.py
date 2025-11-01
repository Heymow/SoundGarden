"""
Collab Warz Discord Bot Cog for Red-DiscordBot

This cog automates announcements for SoundGarden's Collab Warz competition.
It posts announcements about voting phases, submission phases, themes, and reminders.
Announcements are generated using a free AI API for engaging content.
"""

import discord
from redbot.core import commands, Config, checks
from redbot.core.bot import Red
from datetime import datetime, timedelta
import aiohttp
import asyncio
import json
from typing import Optional

class CollabWarz(commands.Cog):
    """
    Automated announcements for SoundGarden's Collab Warz music competition.
    Manages voting and submission phases with AI-generated announcements.
    """
    
    def __init__(self, bot: Red):
        self.bot = bot
        self.config = Config.get_conf(self, identifier=1234567890, force_registration=True)
        
        default_guild = {
            "announcement_channel": None,
            "current_theme": "Cosmic Dreams",
            "current_phase": "voting",  # "submission" or "voting"
            "submission_deadline": None,
            "voting_deadline": None,
            "auto_announce": True,
            "ai_api_url": "",
            "ai_api_key": ""
        }
        
        self.config.register_guild(**default_guild)
        self.announcement_task = None
        
    def cog_load(self):
        """Start the announcement task when cog loads"""
        self.announcement_task = self.bot.loop.create_task(self.announcement_loop())
        
    def cog_unload(self):
        """Stop the announcement task when cog unloads"""
        if self.announcement_task:
            self.announcement_task.cancel()
    
    async def announcement_loop(self):
        """Background task that checks and posts announcements"""
        await self.bot.wait_until_ready()
        
        while not self.bot.is_closed():
            try:
                for guild in self.bot.guilds:
                    await self.check_and_announce(guild)
            except Exception as e:
                print(f"Error in announcement loop: {e}")
            
            # Check every hour
            await asyncio.sleep(3600)
    
    async def check_and_announce(self, guild: discord.Guild):
        """Check if announcements need to be posted"""
        if not await self.config.guild(guild).auto_announce():
            return
            
        channel_id = await self.config.guild(guild).announcement_channel()
        if not channel_id:
            return
            
        channel = guild.get_channel(channel_id)
        if not channel:
            return
        
        now = datetime.utcnow()
        current_phase = await self.config.guild(guild).current_phase()
        
        # Check if we need to switch phases or post reminders
        # This is a simplified version - in production, you'd track state more carefully
        
    async def generate_announcement(self, guild: discord.Guild, announcement_type: str, theme: str, deadline: Optional[str] = None) -> str:
        """
        Generate an announcement using AI.
        Falls back to template if AI is not configured.
        
        announcement_type: "submission_start", "voting_start", "reminder", "winner"
        """
        # Try AI generation first
        ai_url = await self.config.guild(guild).ai_api_url()
        ai_key = await self.config.guild(guild).ai_api_key()
        
        if ai_url and ai_key:
            try:
                announcement = await self._generate_with_ai(announcement_type, theme, deadline, ai_url, ai_key)
                if announcement:
                    return announcement
            except Exception as e:
                print(f"AI generation failed: {e}")
        
        # Fallback to templates
        return self._get_template_announcement(announcement_type, theme, deadline)
    
    async def _generate_with_ai(self, announcement_type: str, theme: str, deadline: Optional[str], api_url: str, api_key: str) -> Optional[str]:
        """Generate announcement using AI API (OpenAI-compatible format)"""
        
        prompts = {
            "submission_start": f"Create an exciting Discord announcement for a music collaboration competition called 'Collab Warz'. The submission phase is starting. This week's theme is '{theme}'. Make it enthusiastic, creative, and encourage participants. Keep it under 300 characters. Use emojis.",
            "voting_start": f"Create an engaging Discord announcement that voting has started for Collab Warz music competition with theme '{theme}'. Encourage everyone to listen and vote. Deadline: {deadline}. Keep it under 300 characters. Use emojis.",
            "reminder": f"Create a friendly reminder Discord message that voting for Collab Warz (theme: '{theme}') ends soon at {deadline}. Encourage people to vote if they haven't. Keep it under 200 characters. Use emojis.",
            "winner": f"Create a celebratory Discord announcement for the winner of last week's Collab Warz with theme '{theme}'. Make it exciting and congratulatory. Keep it under 250 characters. Use emojis."
        }
        
        prompt = prompts.get(announcement_type, "")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    api_url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-3.5-turbo",
                        "messages": [
                            {"role": "system", "content": "You are a creative announcement writer for a music competition community."},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": 150,
                        "temperature": 0.8
                    },
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"AI API error: {e}")
            return None
    
    def _get_template_announcement(self, announcement_type: str, theme: str, deadline: Optional[str]) -> str:
        """Fallback template announcements"""
        
        templates = {
            "submission_start": f"🎵 **Collab Warz - Submission Phase Open!** 🎵\n\nThis week's theme: **{theme}**\n\nTeam up and create something amazing! Submit your collaborative tracks and let the music flow! 🌿✨",
            
            "voting_start": f"🗳️ **Voting is NOW OPEN!** 🗳️\n\nTheme: **{theme}**\n\nListen to all the incredible submissions and vote for your favorite! Every voice matters! 🎶\n\n⏰ Voting ends: {deadline}",
            
            "reminder": f"⏰ **Reminder!** ⏰\n\nVoting for **{theme}** ends soon at {deadline}!\n\nDon't miss your chance to support your favorite track! 🎵",
            
            "winner": f"🏆 **We Have a Winner!** 🏆\n\nCongratulations to the champions of last week's **{theme}** challenge!\n\nAmazing work! Get ready for the next theme! 🎉🎵"
        }
        
        return templates.get(announcement_type, f"Collab Warz update: {theme}")
    
    @commands.group(name="collabwarz", aliases=["cw"])
    @checks.admin_or_permissions(manage_guild=True)
    async def collabwarz(self, ctx):
        """Collab Warz competition management commands"""
        if ctx.invoked_subcommand is None:
            await ctx.send_help(ctx.command)
    
    @collabwarz.command(name="setchannel")
    async def set_channel(self, ctx, channel: discord.TextChannel):
        """Set the announcement channel for Collab Warz"""
        await self.config.guild(ctx.guild).announcement_channel.set(channel.id)
        await ctx.send(f"✅ Announcement channel set to {channel.mention}")
    
    @collabwarz.command(name="settheme")
    async def set_theme(self, ctx, *, theme: str):
        """Set the current competition theme"""
        await self.config.guild(ctx.guild).current_theme.set(theme)
        await ctx.send(f"✅ Theme set to: **{theme}**")
    
    @collabwarz.command(name="setphase")
    async def set_phase(self, ctx, phase: str):
        """Set the current phase (submission or voting)"""
        phase = phase.lower()
        if phase not in ["submission", "voting"]:
            await ctx.send("❌ Phase must be 'submission' or 'voting'")
            return
        
        await self.config.guild(ctx.guild).current_phase.set(phase)
        await ctx.send(f"✅ Phase set to: **{phase}**")
    
    @collabwarz.command(name="announce")
    async def manual_announce(self, ctx, announcement_type: str):
        """
        Manually post an announcement
        Types: submission_start, voting_start, reminder, winner
        """
        if announcement_type not in ["submission_start", "voting_start", "reminder", "winner"]:
            await ctx.send("❌ Invalid type. Use: submission_start, voting_start, reminder, or winner")
            return
        
        channel_id = await self.config.guild(ctx.guild).announcement_channel()
        if not channel_id:
            await ctx.send("❌ Please set an announcement channel first using `[p]cw setchannel`")
            return
        
        channel = ctx.guild.get_channel(channel_id)
        if not channel:
            await ctx.send("❌ Announcement channel not found")
            return
        
        theme = await self.config.guild(ctx.guild).current_theme()
        deadline = "Soon"  # In production, get from config
        
        async with ctx.typing():
            announcement = await self.generate_announcement(ctx.guild, announcement_type, theme, deadline)
            
            embed = discord.Embed(
                description=announcement,
                color=discord.Color.green()
            )
            embed.set_footer(text="SoundGarden's Collab Warz")
            
            await channel.send(embed=embed)
            await ctx.send(f"✅ Announcement posted in {channel.mention}")
    
    @collabwarz.command(name="setai")
    async def set_ai_config(self, ctx, api_url: str, api_key: str):
        """Set AI API configuration (API key will be hidden)"""
        await self.config.guild(ctx.guild).ai_api_url.set(api_url)
        await self.config.guild(ctx.guild).ai_api_key.set(api_key)
        
        # Delete the message to hide the API key
        try:
            await ctx.message.delete()
        except:
            pass
        
        await ctx.send("✅ AI configuration set (message deleted for security)", delete_after=10)
    
    @collabwarz.command(name="status")
    async def show_status(self, ctx):
        """Show current Collab Warz configuration"""
        channel_id = await self.config.guild(ctx.guild).announcement_channel()
        theme = await self.config.guild(ctx.guild).current_theme()
        phase = await self.config.guild(ctx.guild).current_phase()
        auto = await self.config.guild(ctx.guild).auto_announce()
        
        channel = ctx.guild.get_channel(channel_id) if channel_id else None
        
        embed = discord.Embed(
            title="🎵 Collab Warz Status",
            color=discord.Color.green()
        )
        embed.add_field(name="Theme", value=theme, inline=True)
        embed.add_field(name="Phase", value=phase.title(), inline=True)
        embed.add_field(name="Auto-Announce", value="✅" if auto else "❌", inline=True)
        embed.add_field(name="Channel", value=channel.mention if channel else "Not set", inline=False)
        
        await ctx.send(embed=embed)
    
    @collabwarz.command(name="toggle")
    async def toggle_auto(self, ctx):
        """Toggle automatic announcements"""
        current = await self.config.guild(ctx.guild).auto_announce()
        await self.config.guild(ctx.guild).auto_announce.set(not current)
        
        status = "enabled" if not current else "disabled"
        await ctx.send(f"✅ Automatic announcements {status}")


async def setup(bot: Red):
    """Load the CollabWarz cog"""
    await bot.add_cog(CollabWarz(bot))
