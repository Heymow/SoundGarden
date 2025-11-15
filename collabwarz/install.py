#!/usr/bin/env python3
"""
Script d'installation et de configuration pour Collab Warz Bot
"""

import asyncio
import json
import sys
import subprocess
import os
from pathlib import Path

class CollabWarzInstaller:
    def __init__(self):
        self.config = {}
        self.errors = []
        
    def print_banner(self):
        """Affiche le banner d'installation"""
        banner = """
╔══════════════════════════════════════════════════════════╗
║                   COLLAB WARZ BOT                        ║
║                 Installation Wizard                      ║
╚══════════════════════════════════════════════════════════╝

🎵 Système complet d'automation pour compétitions musicales
🤖 Intégration AI, Discord timestamps, gestion d'équipes
🏆 Récompenses automatiques via YAGPDB
📊 Historique permanent et statistiques
        """
        print(banner)
    
    def check_prerequisites(self):
        """Vérifie les prérequis système"""
        print("🔍 Vérification des prérequis...\n")
        
        # Python version
        python_version = sys.version_info
        if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 8):
            self.errors.append("Python 3.8+ requis")
            print("❌ Python 3.8+ requis")
        else:
            print(f"✅ Python {python_version.major}.{python_version.minor}")
        
        # Red-DiscordBot
        try:
            result = subprocess.run(['redbot', '--version'], capture_output=True, text=True)
            if result.returncode == 0:
                print("✅ Red-DiscordBot installé")
            else:
                self.errors.append("Red-DiscordBot non trouvé")
                print("❌ Red-DiscordBot non installé")
        except FileNotFoundError:
            self.errors.append("Red-DiscordBot non trouvé") 
            print("❌ Red-DiscordBot non installé")
        
        # Dépendances Python
        required_packages = ['aiohttp', 'discord.py']
        for package in required_packages:
            try:
                __import__(package.replace('-', '_'))
                print(f"✅ {package}")
            except ImportError:
                self.errors.append(f"Package {package} manquant")
                print(f"❌ {package}")
        
        if self.errors:
            print(f"\n⚠️  {len(self.errors)} erreur(s) trouvée(s):")
            for error in self.errors:
                print(f"   • {error}")
            
            print("\n📋 Pour corriger:")
            print("   pip install Red-DiscordBot aiohttp")
            return False
        
        print("\n✅ Tous les prérequis sont satisfaits!")
        return True
    
    def collect_configuration(self):
        """Collecte la configuration utilisateur"""
        print("\n⚙️  Configuration du bot...\n")
        
        # API AI
        print("🤖 Configuration IA:")
        self.config['ai_api_url'] = input("   URL API (OpenAI par défaut): ") or "https://api.openai.com/v1"
        self.config['ai_api_key'] = input("   Clé API: ")
        self.config['ai_model'] = input("   Modèle (gpt-3.5-turbo par défaut): ") or "gpt-3.5-turbo"
        
        # Canaux Discord
        print("\n💬 Configuration Discord:")
        self.config['competition_channel'] = input("   ID canal compétition: ")
        self.config['submission_channel'] = input("   ID canal soumissions (optionnel): ")
        self.config['admin_channel'] = input("   ID canal admin (pour YAGPDB): ")
        
        # Paramètres compétition
        print("\n🏆 Paramètres compétition:")
        min_teams = input("   Équipes minimum (2 par défaut): ")
        self.config['min_teams_required'] = int(min_teams) if min_teams else 2
        
        rep_amount = input("   Rep par gagnant (2 par défaut): ")
        self.config['rep_reward_amount'] = int(rep_amount) if rep_amount else 2
        
        validate = input("   Valider soumissions Discord? (y/N): ").lower()
        self.config['validate_discord_submissions'] = validate.startswith('y')
        
        ping = input("   Ping @everyone? (y/N): ").lower()
        self.config['ping_everyone'] = ping.startswith('y')
    
    def validate_configuration(self):
        """Valide la configuration"""
        print("\n✅ Validation de la configuration...")
        
        # Vérifications basiques
        required_fields = ['ai_api_key', 'competition_channel']
        missing = [field for field in required_fields if not self.config.get(field)]
        
        if missing:
            print(f"❌ Champs requis manquants: {', '.join(missing)}")
            return False
        
        # Validation IDs Discord
        discord_ids = ['competition_channel', 'submission_channel', 'admin_channel']
        for field in discord_ids:
            value = self.config.get(field)
            if value and not value.isdigit():
                print(f"❌ {field} doit être un ID Discord numérique")
                return False
        
        print("✅ Configuration valide")
        return True
    
    def generate_setup_commands(self):
        """Génère les commandes Red-DiscordBot"""
        print("\n📜 Commandes de configuration Red-DiscordBot:")
        print("   (Copiez-collez ces commandes dans votre bot Discord)\n")
        
        commands = [
            f"[p]load collabwarz",
            f"[p]cw setapi {self.config['ai_api_url']} {self.config['ai_api_key']}",
            f"[p]cw setmodel {self.config['ai_model']}",
            f"[p]cw setchannel {self.config['competition_channel']}"
        ]
        
        if self.config.get('submission_channel'):
            commands.append(f"[p]cw setsubmissionchannel {self.config['submission_channel']}")
        
        if self.config.get('admin_channel'):
            commands.append(f"[p]cw setadminchannel {self.config['admin_channel']}")
        
        commands.extend([
            f"[p]cw minteams {self.config['min_teams_required']}",
            f"[p]cw setrepamount {self.config['rep_reward_amount']}"
        ])
        
        if not self.config['validate_discord_submissions']:
            commands.append("[p]cw togglevalidation")
        
        if not self.config['ping_everyone']:
            commands.append("[p]cw toggleping")
        
        commands.extend([
            "[p]cw status",
            "[p]cw scheduler on"
        ])
        
        for i, cmd in enumerate(commands, 1):
            print(f"   {i:2d}. {cmd}")
        
        # Sauvegarder dans un fichier
        setup_file = Path("setup_commands.txt")
        with open(setup_file, 'w', encoding='utf-8') as f:
            f.write("# Commandes de configuration Collab Warz Bot\n")
            f.write("# Copiez-collez ces commandes dans Discord\n\n")
            for cmd in commands:
                f.write(f"{cmd}\n")
        
        print(f"\n💾 Commandes sauvées dans: {setup_file.absolute()}")
    
    def create_config_backup(self):
        """Crée une sauvegarde de la configuration"""
        config_backup = {
            "installation_date": "2025-01-09",
            "user_config": self.config,
            "notes": [
                "Configuration générée par l'assistant d'installation",
                "Modifiez les valeurs si nécessaire",
                "Gardez votre clé API secrète"
            ]
        }
        
        backup_file = Path("collab_warz_config.json")
        with open(backup_file, 'w', encoding='utf-8') as f:
            json.dump(config_backup, f, indent=2, ensure_ascii=False)
        
        print(f"📋 Configuration sauvée dans: {backup_file.absolute()}")
    
    def show_next_steps(self):
        """Affiche les prochaines étapes"""
        print("""
🚀 Installation terminée! Prochaines étapes:

1. 📁 Copiez collabwarz.py dans votre dossier cogs Red-DiscordBot
2. 🔄 Redémarrez votre bot ou rechargez les cogs
3. 📜 Exécutez les commandes dans setup_commands.txt
4. 🧪 Testez avec: [p]cw status
5. 🎵 Générez votre premier thème: [p]cw generatetheme

📚 Documentation complète dans README.md
⚠️  Gardez votre clé API secrète et sécurisée!

🎉 Votre bot Collab Warz est prêt à l'emploi!
        """)
    
    def run_installation(self):
        """Lance le processus d'installation complet"""
        try:
            self.print_banner()
            
            if not self.check_prerequisites():
                return False
            
            self.collect_configuration()
            
            if not self.validate_configuration():
                return False
            
            self.generate_setup_commands()
            self.create_config_backup()
            self.show_next_steps()
            
            return True
            
        except KeyboardInterrupt:
            print("\n\n⚠️  Installation interrompue par l'utilisateur")
            return False
        except Exception as e:
            print(f"\n❌ Erreur d'installation: {e}")
            return False

def main():
    installer = CollabWarzInstaller()
    success = installer.run_installation()
    
    if not success:
        print("\n❌ Installation échouée")
        sys.exit(1)
    
    print("\n✅ Installation réussie!")

if __name__ == "__main__":
    main()