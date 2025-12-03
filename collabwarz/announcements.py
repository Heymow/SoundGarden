"""
Announcement Manager for CollabWarz Discord Bot

Handles all announcement-related logic including:
- Background announcement loop
- Phase checking and transitions
- AI-generated announcements
- Confirmation workflows
- Theme management
"""

import asyncio
import aiohttp
import discord
from datetime import datetime, timedelta
from typing import Optional


class AnnouncementManager:
    def __init__(self, cog):
        """Initialize AnnouncementManager with reference to parent cog"""
        self.cog = cog
        self.bot = cog.bot
        self.config = cog.config
    
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
        theme = await self.config.guild(guild).current_theme()
        last_announcement = await self.config.guild(guild).last_announcement()
        winner_announced = await self.config.guild(guild).winner_announced()
        biweekly_mode = await self.config.guild(guild).biweekly_mode()
        
        # Check if this is a competition week (for bi-weekly mode)
        is_competition_week = await self.cog._is_competition_week(guild)
        
        # In bi-weekly mode, during off weeks, set phase to inactive
        if biweekly_mode and not is_competition_week:
            if current_phase not in ["inactive", "paused"]:
                await self.config.guild(guild).current_phase.set("inactive")
            return  # Skip all announcements during off weeks
        
        # Calculate current phase based on day of week
        day = now.weekday()  # 0 = Monday, 6 = Sunday
        iso_year, iso_week, _ = now.isocalendar()
        
        # Regular weekly schedule
        if day < 4:  # Monday to Thursday
            expected_phase = "submission"
        elif day == 4 and now.hour < 12:  # Friday before noon
            expected_phase = "submission"
        else:  # Friday noon onwards to Sunday
            expected_phase = "voting"
        
        # Get current competition identifier for tracking
        competition_key = await self.cog._get_competition_week_key(guild)
        current_week = iso_week  # Keep for backwards compatibility
        
        # Check for phase transitions
        announcement_posted = False
        
        # 1. Check if we need to announce start of submission phase
        week_cancelled = await self.config.guild(guild).week_cancelled()
        face_off_active = await self.config.guild(guild).face_off_active()
        
        should_restart = False
        if face_off_active:
            # Check if face-off deadline has passed
            face_off_deadline_str = await self.config.guild(guild).face_off_deadline()
            if face_off_deadline_str:
                face_off_deadline = datetime.fromisoformat(face_off_deadline_str)
                
                if now >= face_off_deadline:
                    # Face-off time is up, process results
                    await self.cog._process_voting_end(guild)
                    
                    # Start new week on Tuesday if face-off just ended
                    if day == 1:  # Tuesday
                        should_restart = True
        else:
            # Check if we should start a new competition
            if biweekly_mode:
                should_restart = (is_competition_week and
                                 expected_phase == "submission" and 
                                 (current_phase != "submission" or current_phase == "cancelled" or week_cancelled) and 
                                 last_announcement != f"submission_start_{competition_key}" and
                                 day == 0)  # Monday only
            else:
                should_restart = (expected_phase == "submission" and 
                                 (current_phase != "submission" or current_phase == "cancelled" or week_cancelled) and 
                                 last_announcement != f"submission_start_{competition_key}" and
                                 day == 0)  # Monday only
        
        if should_restart:
            # Reset cancelled week flag
            if week_cancelled:
                await self.config.guild(guild).week_cancelled.set(False)
            
            # Check if we have a pending theme for this week
            await self._apply_next_week_theme_if_ready(guild)
            
            # Get the current theme (may have been updated)
            current_theme = await self.config.guild(guild).current_theme()
            
            await self._post_announcement(channel, guild, "submission_start", current_theme)
            await self.config.guild(guild).current_phase.set("submission")
            await self.config.guild(guild).last_announcement.set(f"submission_start_{competition_key}")
            await self.config.guild(guild).winner_announced.set(False)
            await self.config.guild(guild).theme_generation_done.set(False)
            await self.config.guild(guild).week_cancelled.set(False)
            announcement_posted = True
        
        # 2. Check if we need to announce start of voting phase
        elif (expected_phase == "voting" and 
              current_phase != "voting" and 
              last_announcement != f"voting_start_{competition_key}"):
            
            should_start_voting = (day == 4 and now.hour >= 12)  # Friday noon
                
            if should_start_voting:
                # Check if we have enough teams to proceed
                team_count = await self.cog._count_participating_teams(guild)
                min_teams = await self.config.guild(guild).min_teams_required()
                try:
                    min_teams = int(min_teams) if min_teams is not None else 2
                except Exception:
                    min_teams = 2
                
                if team_count < min_teams:
                    # Cancel the competition
                    await self.cog._cancel_week_and_restart(guild, channel, theme)
                    announcement_posted = True
                else:
                    # Proceed with voting
                    await self._post_announcement(channel, guild, "voting_start", theme)
                    await self.config.guild(guild).current_phase.set("voting")
                    await self.config.guild(guild).last_announcement.set(f"voting_start_{competition_key}")
                    announcement_posted = True
        
        # 3. Check for reminder announcements
        if not announcement_posted:
            # Submission reminder (Thursday evening)
            if (expected_phase == "submission" and 
                day == 3 and now.hour >= 18 and
                last_announcement != f"submission_reminder_{competition_key}"):
                
                reminder_text = "Friday 12:00"
                if biweekly_mode:
                    reminder_text += " (Next competition in 2 weeks)"
                
                await self._post_announcement(channel, guild, "reminder", theme, reminder_text)
                await self.config.guild(guild).last_announcement.set(f"submission_reminder_{competition_key}")
                announcement_posted = True
            
            # Voting reminder (Saturday evening)
            elif (expected_phase == "voting" and 
                  day == 5 and now.hour >= 18 and
                  last_announcement != f"voting_reminder_{competition_key}"):
                
                await self._post_announcement(channel, guild, "reminder", theme, "Sunday 23:59")
                await self.config.guild(guild).last_announcement.set(f"voting_reminder_{competition_key}")
                announcement_posted = True
        
        # 4. Check for winner announcement (Sunday evening)
        should_announce_winner = (day == 6 and now.hour >= 20)  # Sunday after 8 PM
            
        if (not announcement_posted and 
            should_announce_winner and
            not winner_announced and
            last_announcement != f"winner_{competition_key}"):
            
            # Process voting results automatically
            await self.cog._process_voting_end(guild)
            await self.config.guild(guild).last_announcement.set(f"winner_{competition_key}")
        
        # 5. Check for next theme generation (Sunday evening)
        theme_generation_done = await self.config.guild(guild).theme_generation_done()
        next_week_theme = await self.config.guild(guild).next_week_theme()
        
        should_generate_theme = (day == 6 and now.hour >= 21)  # Sunday after 9 PM
        
        if (not announcement_posted and
            should_generate_theme and
            winner_announced and
            not theme_generation_done and
            not next_week_theme):
            
            await self._generate_next_week_theme(guild)
            await self.config.guild(guild).theme_generation_done.set(True)
    
    async def _post_announcement(self, channel, guild, announcement_type: str, theme: str, deadline: str = None, force: bool = False):
        """Helper method to post an announcement"""
        try:
            # Check if confirmation is required
            require_confirmation = await self.config.guild(guild).require_confirmation()
            admin_id = await self.config.guild(guild).admin_user_id()
            
            if require_confirmation and not force and admin_id:
                # Store pending announcement and request confirmation
                pending_data = {
                    "type": announcement_type,
                    "theme": theme,
                    "deadline": deadline,
                    "channel_id": channel.id,
                    "timestamp": datetime.utcnow().isoformat()
                }
                await self.config.guild(guild).pending_announcement.set(pending_data)
                
                # Send confirmation request to admin
                admin_user = self.bot.get_user(admin_id)
                if admin_user:
                    await self._send_confirmation_request(admin_user, guild, announcement_type, theme, deadline)
                    print(f"Confirmation request sent to admin for {announcement_type} in {guild.name}")
                    return
            
            # Generate announcement
            announcement = await self.generate_announcement(guild, announcement_type, theme, deadline)
            
            embed = discord.Embed(
                description=announcement,
                color=discord.Color.green()
            )
            embed.set_footer(text="SoundGarden's Collab Warz")
            
            # Check if @everyone ping is enabled
            use_everyone_ping = await self.config.guild(guild).use_everyone_ping()
            
            if use_everyone_ping:
                await channel.send("@everyone", embed=embed)
            else:
                await channel.send(embed=embed)
            print(f"Posted {announcement_type} announcement in {guild.name}")
            
            # Clear pending announcement
            await self.config.guild(guild).pending_announcement.set(None)
            
        except Exception as e:
            print(f"Error posting announcement in {guild.name}: {e}")
    
    async def _send_confirmation_request(self, admin_user, guild, announcement_type: str, theme: str, deadline: str = None):
        """Send a confirmation request to the admin via DM"""
        try:
            # Generate preview
            preview = await self.generate_announcement(guild, announcement_type, theme, deadline)
            
            embed = discord.Embed(
                title="🤖 Collab Warz - Confirmation Required",
                description=f"**Server:** {guild.name}\n**Type:** {announcement_type.replace('_', ' ').title()}",
                color=discord.Color.blue()
            )
            
            embed.add_field(
                name="📝 Proposed Announcement",
                value=preview[:1000] + ("..." if len(preview) > 1000 else ""),
                inline=False
            )
            
            embed.add_field(
                name="🎵 Current Theme",
                value=f"**{theme}**",
                inline=True
            )
            
            if deadline:
                embed.add_field(
                    name="⏰ Deadline",
                    value=deadline,
                    inline=True
                )
            
            # Determine timeout
            if announcement_type == "submission_start":
                timeout_msg = "⏰ **Auto-posts at next Monday 9 AM UTC if no response**"
            else:
                timeout_minutes = (await self.config.guild(guild).confirmation_timeout()) // 60
                timeout_msg = f"⏰ **Auto-posts in {timeout_minutes} minutes if no response**"
            
            embed.add_field(
                name="📋 Actions Available",
                value=(
                    "✅ **React with ✅** to approve and post\n"
                    "❌ **React with ❌** to cancel\n"
                    "🔄 **React with 🔄** then reply `newtheme: Your Theme`\n"
                    f"💬 Or use `[p]cw confirm {guild.id}` to approve\n"
                    f"🚫 Or use `[p]cw deny {guild.id}` to cancel\n\n"
                    f"{timeout_msg}"
                ),
                inline=False
            )
            
            embed.set_footer(text=f"Guild ID: {guild.id} | Auto-expires in 30 minutes")
            
            message = await admin_user.send(embed=embed)
            
            # Add reaction options
            await message.add_reaction("✅")
            await message.add_reaction("❌")
            await message.add_reaction("🔄")
            
            # Start timeout task
            if announcement_type == "submission_start":
                timeout = self._calculate_smart_timeout(announcement_type)
            else:
                timeout = await self.config.guild(guild).confirmation_timeout()
            
            self.bot.loop.create_task(self._handle_confirmation_timeout(guild, timeout))
            
        except Exception as e:
            print(f"Error sending confirmation request: {e}")
    
    async def _handle_confirmation_timeout(self, guild, timeout_seconds: int):
        """Handle automatic posting if no confirmation received"""
        await asyncio.sleep(timeout_seconds)
        
        # Check if there's still a pending announcement
        pending = await self.config.guild(guild).pending_announcement()
        if not pending:
            return
        
        try:
            # Auto-post the announcement
            channel = guild.get_channel(pending["channel_id"])
            if channel:
                await self._post_announcement(
                    channel, guild, pending["type"], 
                    pending["theme"], pending.get("deadline"), force=True
                )
                
                # Notify admin
                admin_id = await self.config.guild(guild).admin_user_id()
                if admin_id:
                    admin_user = self.bot.get_user(admin_id)
                    if admin_user:
                        try:
                            await admin_user.send(
                                f"⏰ **Auto-posted after timeout**\n"
                                f"Server: {guild.name}\n"
                                f"Type: {pending['type'].replace('_', ' ').title()}\n"
                                f"Theme: {pending['theme']}\n\n"
                                f"*No response received within {timeout_seconds//60} minutes*"
                            )
                        except:
                            pass
                
                print(f"Auto-posted {pending['type']} announcement after timeout in {guild.name}")
        except Exception as e:
            print(f"Error auto-posting announcement in {guild.name}: {e}")
    
    async def _generate_next_week_theme(self, guild):
        """Generate theme for next week and request admin confirmation"""
        try:
            # Check if theme already exists
            existing_theme = await self.config.guild(guild).next_week_theme()
            if existing_theme:
                print(f"Theme already exists for next week in {guild.name}: {existing_theme}")
                return
            
            ai_url = await self.config.guild(guild).ai_api_url()
            ai_key = await self.config.guild(guild).ai_api_key()
            
            if not (ai_url and ai_key):
                print(f"No AI configuration for theme generation in {guild.name}")
                return
            
            # Generate new theme
            suggested_theme = await self._generate_theme_with_ai(ai_url, ai_key, guild)
            
            if not suggested_theme:
                print(f"Failed to generate theme for {guild.name}")
                return
            
            # Store suggested theme
            await self.config.guild(guild).next_week_theme.set(suggested_theme)
            
            # Send confirmation to admin
            admin_id = await self.config.guild(guild).admin_user_id()
            if admin_id:
                admin_user = self.bot.get_user(admin_id)
                if admin_user:
                    await self._send_theme_confirmation_request(admin_user, guild, suggested_theme)
                    
                    next_week = (datetime.utcnow().isocalendar()[1] + 1) % 53 or 1
                    await self.config.guild(guild).pending_theme_confirmation.set({
                        "theme": suggested_theme,
                        "week": next_week,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    
                    print(f"Theme generation request sent to admin for {guild.name}: {suggested_theme}")
        
        except Exception as e:
            print(f"Error generating next week theme in {guild.name}: {e}")
    
    async def _generate_theme_with_ai(self, api_url: str, api_key: str, guild) -> Optional[str]:
        """Generate a new theme using AI"""
        prompt = (
            "Generate a creative and inspiring theme for a weekly music collaboration competition. "
            "The theme should be 2-4 words, evocative, and spark creativity for musicians. "
            "Examples: 'Cosmic Dreams', 'Urban Legends', 'Ocean Depths', 'Heart Break', 'Forest Tales'. "
            "Never use 'Neon', 'Rain', 'City', 'Cracks', 'Coffee', 'Stains', 'Lights', 'Untold', 'Waves', 'Skyline', 'Midnight', 'Echoes', 'Shadows', 'Reflections', 'Whispers', 'Memories', 'Unfold', 'Embrace', 'Void', or similar overused words. "
            "Respond with ONLY the theme name, no quotes or additional text."
        )
        
        # Get AI parameters
        ai_model = await self.config.guild(guild).ai_model() or "gpt-3.5-turbo"
        ai_temperature = await self.config.guild(guild).ai_temperature() or 0.9
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    api_url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": ai_model,
                        "messages": [
                            {"role": "system", "content": "You are a creative theme generator for music competitions."},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": 20,
                        "temperature": ai_temperature
                    },
                    timeout=aiohttp.ClientTimeout(total=15)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        theme = data["choices"][0]["message"]["content"].strip()
                        theme = theme.strip('"\'').strip()
                        return theme
        except Exception as e:
            print(f"AI theme generation error: {e}")
            return None
    
    async def _send_theme_confirmation_request(self, admin_user, guild, suggested_theme: str):
        """Send theme confirmation request to admin via DM"""
        try:
            current_theme = await self.config.guild(guild).current_theme()
            
            embed = discord.Embed(
                title="🎨 Next Week Theme - Confirmation Required",
                description=f"**Server:** {guild.name}\n**For:** Next week's competition",
                color=discord.Color.purple()
            )
            
            embed.add_field(
                name="🤖 AI Generated Theme",
                value=f"**{suggested_theme}**",
                inline=False
            )
            
            embed.add_field(
                name="📝 Current Theme",
                value=f"*{current_theme}* (this week)",
                inline=True
            )
            
            embed.add_field(
                name="📅 Timeline",
                value="• **Now**: Preview for next week\n• **Monday 9 AM**: Theme will be used\n• **You have until Monday morning** to decide",
                inline=False
            )
            
            embed.add_field(
                name="📋 Actions Available",
                value=(
                    "✅ **React with ✅** to approve AI theme\n"
                    "❌ **React with ❌** to keep current theme\n"
                    "🎨 **Reply with:** `nexttheme: Your Custom Theme`\n"
                    f"💬 Or use `[p]cw confirmtheme {guild.id}` to approve\n"
                    f"🚫 Or use `[p]cw denytheme {guild.id}` to reject\n\n"
                    "⏰ **If no response by Monday 9 AM: AI theme will be used automatically**"
                ),
                inline=False
            )
            
            embed.set_footer(text=f"Guild ID: {guild.id} | Theme for next week")
            
            message = await admin_user.send(embed=embed)
            
            # Add reaction options
            await message.add_reaction("✅")
            await message.add_reaction("❌")
            await message.add_reaction("🎨")
            
        except Exception as e:
            print(f"Error sending theme confirmation request: {e}")
    
    async def _apply_next_week_theme_if_ready(self, guild):
        """Apply next week theme if available and it's Monday"""
        try:
            next_week_theme = await self.config.guild(guild).next_week_theme()
            
            if next_week_theme:
                # Apply the theme
                await self.config.guild(guild).current_theme.set(next_week_theme)
                print(f"Applied next week theme in {guild.name}: {next_week_theme}")
                
                # Clear next week theme
                await self.config.guild(guild).next_week_theme.set(None)
                await self.config.guild(guild).pending_theme_confirmation.set(None)
                
                # Notify admin
                admin_id = await self.config.guild(guild).admin_user_id()
                if admin_id:
                    admin_user = self.bot.get_user(admin_id)
                    if admin_user:
                        try:
                            await admin_user.send(
                                f"🎨 **Theme Applied for New Week**\n"
                                f"Server: {guild.name}\n"
                                f"New Theme: **{next_week_theme}**\n"
                                f"The new week has started with this theme!"
                            )
                        except:
                            pass
                            
        except Exception as e:
            print(f"Error applying next week theme in {guild.name}: {e}")
    
    def _calculate_smart_timeout(self, announcement_type: str) -> int:
        """Calculate timeout based on announcement type"""
        now = datetime.utcnow()
        
        if announcement_type == "submission_start":
            # For submission start, use next Monday
            days_until_monday = (7 - now.weekday()) % 7
            if days_until_monday == 0 and now.hour < 9:
                return 3600  # 1 hour
            elif days_until_monday == 0:
                next_monday = now + timedelta(days=7)
            else:
                next_monday = now + timedelta(days=days_until_monday)
            
            next_monday = next_monday.replace(hour=9, minute=0, second=0, microsecond=0)
            timeout_seconds = int((next_monday - now).total_seconds())
            
            return max(3600, min(timeout_seconds, 7*24*3600))
        else:
            return 1800  # 30 minutes default
    
    async def generate_announcement(self, guild: discord.Guild, announcement_type: str, theme: str, deadline: Optional[str] = None) -> str:
        """Generate an announcement using AI or templates"""
        # Try AI generation first
        ai_url = await self.config.guild(guild).ai_api_url()
        ai_key = await self.config.guild(guild).ai_api_key()
        
        if ai_url and ai_key:
            try:
                announcement = await self._generate_with_ai(announcement_type, theme, deadline, ai_url, ai_key, guild)
                if announcement:
                    return announcement
            except Exception as e:
                print(f"AI generation failed: {e}")
        
        # Fallback to templates
        return await self._get_template_announcement(guild, announcement_type, theme, deadline)
    
    async def _generate_with_ai(self, announcement_type: str, theme: str, deadline: Optional[str], api_url: str, api_key: str, guild) -> Optional[str]:
        """Generate announcement using AI API"""
        # Generate Discord timestamp for deadline
        if not deadline:
            deadline_dt = self.cog._get_next_deadline(announcement_type)
            deadline = self.cog._create_discord_timestamp(deadline_dt, "R")
            deadline_full = self.cog._create_discord_timestamp(deadline_dt, "F")
        else:
            deadline_full = deadline
        
        prompts = {
            "submission_start": f"Create an exciting Discord announcement for a music collaboration competition called 'Collab Warz'. The submission phase is starting. This week's theme is '{theme}'. Include the deadline as '{deadline_full}'. Make it enthusiastic, creative, and encourage participants. Keep it under 300 characters. Use emojis.",
            "voting_start": f"Create an engaging Discord announcement that voting has started for Collab Warz music competition with theme '{theme}'. Encourage everyone to listen and vote. Include the deadline as '{deadline_full}'. Keep it under 300 characters. Use emojis.",
            "reminder": f"Create a friendly reminder Discord message that voting for Collab Warz (theme: '{theme}') ends {deadline}. Encourage people to vote if they haven't. Keep it under 200 characters. Use emojis.",
            "winner": f"Create a celebratory Discord announcement for the winner of last week's Collab Warz with theme '{theme}'. Make it exciting and congratulatory. Keep it under 250 characters. Use emojis."
        }
        
        prompt = prompts.get(announcement_type, "")
        
        # Get AI parameters
        ai_model = await self.config.guild(guild).ai_model() or "gpt-3.5-turbo"
        ai_temperature = await self.config.guild(guild).ai_temperature() or 0.8
        ai_max_tokens = await self.config.guild(guild).ai_max_tokens() or 150
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    api_url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": ai_model,
                        "messages": [
                            {"role": "system", "content": "You are a creative announcement writer for a music competition community."},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": ai_max_tokens,
                        "temperature": ai_temperature
                    },
                    timeout=aiohttp.ClientTimeout(total=15)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"AI API error: {e}")
            return None
    
    async def _get_template_announcement(self, guild, announcement_type: str, theme: str, deadline: Optional[str]) -> str:
        """Fallback template announcements"""
        # Check bi-weekly mode
        biweekly_mode = await self.config.guild(guild).biweekly_mode()
        
        # Generate Discord timestamp if needed
        if not deadline:
            deadline_dt = self.cog._get_next_deadline(announcement_type)
            deadline = self.cog._create_discord_timestamp(deadline_dt, "R")
            deadline_full = self.cog._create_discord_timestamp(deadline_dt, "F")
        else:
            deadline_full = deadline
        
        # Mode-specific text
        if biweekly_mode:
            cycle_text = "🎵 **Collab Warz - COMPETITION WEEK!** 🎵\n\n✨ **This week's theme:** **{theme}** ✨\n\n📝 **Submission Phase:** Monday to Friday noon\n🗳️ **Voting Phase:** Friday noon to Sunday\n\nTeam up with someone and create magic together! 🤝"
            winner_next = "🔥 Enjoy next week's break, then get ready for the next competition!\n\n*Next competition starts in 2 weeks!* 🚀"
            schedule_info = "📅 **Bi-Weekly Schedule:** Competition every other week (odd weeks only)"
        else:
            cycle_text = "🎵 **Collab Warz - NEW WEEK STARTS!** 🎵\n\n✨ **This week's theme:** **{theme}** ✨\n\n📝 **Submission Phase:** Monday to Friday noon\n🗳️ **Voting Phase:** Friday noon to Sunday\n\nTeam up with someone and create magic together! 🤝"
            winner_next = "🔥 Get ready for next week's challenge!\n\n*New theme drops Monday morning!* 🚀"
            schedule_info = ""
        
        templates = {
            "submission_start": f"{cycle_text.format(theme=theme)}\n\n**📋 How to Submit (Discord):**\nIn ONE message, include:\n• `Team name: YourTeamName`\n• Tag your partner: `@username`\n• Your Suno.com link (only accepted format)\n\n**🌐 Alternative:** Submit & vote on our website:\n**https://collabwarz.soundgarden.app**\n\n**💡 Need Help?** Use `!info` for submission guide or `!status` for current competition status\n\n{schedule_info}\n\n⏰ **Submissions deadline:** {deadline_full}",
            
            "voting_start": f"🗳️ **VOTING IS NOW OPEN!** 🗳️\n\n🎵 **Theme:** **{theme}**\n\nThe submissions are in! Time to listen and vote for your favorites! 🎧\n\n**🌐 Listen & Vote:** https://collabwarz.soundgarden.app\n\n**💡 Commands:** Use `!info` for competition guide or `!status` for detailed status\n\nEvery vote counts - support the artists! 💫\n\n⏰ **Voting closes:** {deadline_full}",
            
            "reminder": f"⏰ **FINAL CALL!** ⏰\n\n{'🎵 Submissions' if 'submission' in announcement_type else '🗳️ Voting'} for **{theme}** ends {deadline}!\n\n{'Submit your collaboration now!' if 'submission' in announcement_type else 'Cast your votes and support the artists!'} 🎶\n\n🌐 **Website:** https://collabwarz.soundgarden.app\n💡 **Help:** Use `!info` or `!status` for guidance\n\n{'⏰ Last chance to team up and create!' if 'submission' in announcement_type else '⏰ Every vote matters!'}",
            
            "winner": f"🏆 **WINNER ANNOUNCEMENT!** 🏆\n\n🎉 Congratulations to the champions of **{theme}**! 🎉\n\nIncredible collaboration and amazing music! 🎵✨\n\n🌐 **Listen to all tracks:** https://collabwarz.soundgarden.app\n💡 **Commands:** Use `!info` for competition guide or `!status` for details\n\n{winner_next}"
        }
        
        return templates.get(announcement_type, f"Collab Warz update: {theme}")
