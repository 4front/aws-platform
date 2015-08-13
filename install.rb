#!/System/Library/Frameworks/Ruby.framework/Versions/Current/usr/bin/ruby
# By Ivan Storck http://ivanstorck.com
# Install script helper functions copied from https://github.com/homebrew/install
# Hombrew functions Copyright 2009-2015 Homebrew contributors
# Additional functionality Copyright 2015 Aerobatic
# BSD 2 Clause (NetBSD) license at https://github.com/Homebrew/homebrew/blob/master/LICENSE.txt
# Users should run this command to use:
# https://raw.githubusercontent.com/4front/aws-platform/master/install.rb
# TODO replace with master instaed of install-script branch above

FOURFRONT_REPO = 'https://github.com/4front/aws-platform'
FOURFRONT_PREFIX = "#{ENV['HOME']}/4front"

module Tty extend self
  def blue; bold 34; end
  def white; bold 39; end
  def red; underline 31; end
  def reset; escape 0; end
  def bold n; escape "1;#{n}" end
  def underline n; escape "4;#{n}" end
  def escape n; "\033[#{n}m" if STDOUT.tty? end
end

class Array
  def shell_s
    cp = dup
    first = cp.shift
    cp.map{ |arg| arg.gsub " ", "\\ " }.unshift(first) * " "
  end
end

def ohai *args
  puts "#{Tty.blue}==>#{Tty.white} #{args.shell_s}#{Tty.reset}"
end

def warn warning
  puts "#{Tty.red}Warning#{Tty.reset}: #{warning.chomp}"
end

def system *args
  abort "Failed during: #{args.shell_s}" unless Kernel.system(*args)
end

def sudo *args
  ohai "/usr/bin/sudo", *args
  system "/usr/bin/sudo", *args
end

def getc  # NOTE only tested on OS X
  system "/bin/stty raw -echo"
  if STDIN.respond_to?(:getbyte)
    STDIN.getbyte
  else
    STDIN.getc
  end
ensure
  system "/bin/stty -raw echo"
end

def wait_for_user
  puts
  puts "Press RETURN to continue or any other key to abort"
  c = getc
  # we test for \r and \n because some stuff does \r instead
  abort unless c == 13 or c == 10
end

class Version
  include Comparable
  attr_reader :parts

  def initialize(str)
    @parts = str.split(".").map { |i| i.to_i }
  end

  def <=>(other)
    parts <=> self.class.new(other).parts
  end
end

def macos_version
  @macos_version ||= Version.new(`/usr/bin/sw_vers -productVersion`.chomp[/10\.\d+/])
end

def git
  @git ||= if ENV['GIT'] and File.executable? ENV['GIT']
    ENV['GIT']
  elsif Kernel.system '/usr/bin/which -s git'
    'git'
  else
    exe = `xcrun -find git 2>/dev/null`.chomp
    exe if $? && $?.success? && !exe.empty? && File.executable?(exe)
  end

  return unless @git
  # Github only supports HTTPS fetches on 1.7.10 or later:
  # https://help.github.com/articles/https-cloning-errors
  `#{@git} --version` =~ /git version (\d\.\d+\.\d+)/
  return if $1.nil? or Version.new($1) < "1.7.10"

  @git
end

def node
  # check for NVM, great!
  @node ||= if ENV['NVM_BIN'] and File.executable? File.join(ENV['NVM_BIN'],'node')
  elsif Kernel.system '/usr/bin/which -s node'
    'node'
  else
    exe = `xcrun -find node 2>/dev/null`.chomp
    exe if $? && $?.success? && !exe.empty? && File.executable?(exe)
  end

  return unless @node
  @node
end

def chmod?(d)
  File.directory?(d) && !(File.readable?(d) && File.writable?(d) && File.executable?(d))
end

def chgrp?(d)
  !File.grpowned?(d)
end

# Invalidate sudo timestamp before exiting
at_exit { Kernel.system "/usr/bin/sudo", "-k" }

# The block form of Dir.chdir fails later if Dir.CWD doesn't exist which I
# guess is fair enough. Also sudo prints a warning message for no good reason
Dir.chdir "/usr"

####################################################################### script
abort "See Linux installer: http://4front.io/linux-installer/" if /linux/i === RUBY_PLATFORM
abort "MacOS too old, see: https://github.com/mistydemeo/tigerbrew" if macos_version < "10.6"
abort "Don't run this as root!" if Process.uid == 0
abort <<-EOABORT unless `groups`.split.include? "admin"
This script requires the user #{ENV['USER']} to be an Administrator. If this
sucks for you then you can install 4front in your home directory or however
you please; please refer to our homepage. If you still want to use this script
set your user to be an Administrator in System Preferences or `su' to a
non-root user with Administrator privileges.
EOABORT
abort <<-EOABORT unless File.exists?('/usr/local/bin/brew')
4front requires the Mac OS X Homebrew package manager. Get it from http://brew.sh
or run: ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)
EOABORT
abort <<-EOABORT unless Dir["#{FOURFRONT_PREFIX}/.git/*"].empty?
It appears 4Front is already installed. If your intent is to reinstall you
should do the following before running this installer again:
    rm -rf #{FOURFRONT_PREFIX}/
EOABORT
abort <<-EOABORT if `/usr/bin/xcrun clang 2>&1` =~ /license/ && !$?.success?
You have not agreed to the Xcode license.
Before running the installer again please agree to the license by opening
Xcode.app or running:
    sudo xcodebuild -license
EOABORT

ohai "This script will install 4front into:"
puts "#{FOURFRONT_PREFIX}"

wait_for_user if STDIN.tty?

if macos_version >= "10.9"
  developer_dir = `/usr/bin/xcode-select -print-path 2>/dev/null`.chomp
  if developer_dir.empty? || !File.exist?("#{developer_dir}/usr/bin/git")
    ohai "Installing the Command Line Tools (expect a GUI popup):"
    sudo "/usr/bin/xcode-select", "--install"
    puts "Press any key when the installation has completed."
    getc
  end
end

ohai "Installing dependencies..."
warn <<-CAVEATS
Make sure to read the info for each package and set up services or copy
commands to start services. You can type `brew info PACKAGE_NAME` if the info
is no longer on your screen. You will need another terminal window for this.
CAVEATS

system "brew install pow"
system "brew install dynamodb-local"
system "brew install redis"

ohai "Please scroll up to read the Caveats for each brew package."

wait_for_user if STDIN.tty?

ohai "Downloading and installing 4Front..."

if File.exists?(FOURFRONT_PREFIX)
  warn "4front directory alrady found, updating instead of installing"
else
  Dir.mkdir(FOURFRONT_PREFIX, 0700)
end

Dir.chdir FOURFRONT_PREFIX do
  if git
    # we do it in four steps to avoid merge errors when reinstalling
    system git, "init", "-q"

    # "git remote add" will fail if the remote is defined in the global config
    system git, "config", "remote.origin.url", FOURFRONT_REPO
    system git, "config", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*"

    args = git, "fetch", "origin", "master:refs/remotes/origin/master", "-n"
    args << "--depth=1" unless ARGV.include?("--full") || !ENV["FOURFRONT_DEVELOPER"].nil?
    system(*args)

    system git, "reset", "--hard", "origin/master"
  else
    # -m to stop tar erroring out if it can't modify the mtime for root owned directories
    # pipefail to cause the exit status from curl to propagate if it fails
    curl_flags = "fsSL"
    system "/bin/bash -o pipefail -c '/usr/bin/curl -#{curl_flags} #{FOURFRONT_REPO}/tarball/master | /usr/bin/tar xz -m --strip 1'"
  end
  if node
    system "npm install"
    system "node ./node_modules/4front-dynamodb/scripts/create-local-tables.js"
  else
    abort 'You need a working NodeJS install. Try `brew install nvm`'
  end
end

ohai "Installation successful!"
ohai "Next steps"

if macos_version < "10.9" and macos_version > "10.6"
  `/usr/bin/cc --version 2> /dev/null` =~ %r[clang-(\d{2,})]
  version = $1.to_i
  puts "Install the #{Tty.white}Command Line Tools for Xcode#{Tty.reset}: https://developer.apple.com/downloads" if version < 425
else
  puts "Install #{Tty.white}Xcode#{Tty.reset}: https://developer.apple.com/xcode" unless File.exist? "/usr/bin/cc"
end

puts "Run `npm start` to start the 4front platform server."
