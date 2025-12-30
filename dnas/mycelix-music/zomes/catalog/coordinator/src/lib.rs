//! Catalog Coordinator Zome
//!
//! Provides the callable functions for managing the music catalog.
//! Handles song uploads, album creation, and artist profile management.

use catalog_integrity::*;
use hdk::prelude::*;

/// Create a new song entry
#[hdk_extern]
pub fn create_song(song: Song) -> ExternResult<ActionHash> {
    let action_hash = create_entry(&EntryTypes::Song(song.clone()))?;

    // Link from artist to song
    let artist_path = Path::from(format!("artists/{}", song.artist));
    artist_path.ensure()?;
    create_link(
        artist_path.path_entry_hash()?,
        action_hash.clone(),
        LinkTypes::ArtistToSongs,
        (),
    )?;

    // Link to all songs anchor
    let all_songs_path = Path::from("all_songs");
    all_songs_path.ensure()?;
    create_link(
        all_songs_path.path_entry_hash()?,
        action_hash.clone(),
        LinkTypes::AllSongs,
        (),
    )?;

    // Link from each genre
    for genre in &song.genres {
        let genre_path = Path::from(format!("genres/{}", genre.to_lowercase()));
        genre_path.ensure()?;
        create_link(
            genre_path.path_entry_hash()?,
            action_hash.clone(),
            LinkTypes::GenreToSongs,
            (),
        )?;
    }

    Ok(action_hash)
}

/// Get a song by its action hash
#[hdk_extern]
pub fn get_song(action_hash: ActionHash) -> ExternResult<Option<Song>> {
    let record = get(action_hash, GetOptions::default())?;
    match record {
        Some(r) => Ok(r.entry().to_app_option().map_err(|e| wasm_error!(e))?),
        None => Ok(None),
    }
}

/// Get all songs by an artist
#[hdk_extern]
pub fn get_songs_by_artist(artist: AgentPubKey) -> ExternResult<Vec<Song>> {
    let artist_path = Path::from(format!("artists/{}", artist));
    let links = get_links(
        GetLinksInputBuilder::try_new(artist_path.path_entry_hash()?, LinkTypes::ArtistToSongs)?
            .build(),
    )?;

    let mut songs = Vec::new();
    for link in links {
        if let Some(action_hash) = link.target.into_action_hash() {
            if let Some(song) = get_song(action_hash)? {
                songs.push(song);
            }
        }
    }
    Ok(songs)
}

/// Get all songs (paginated)
#[derive(Serialize, Deserialize, Debug)]
pub struct GetAllSongsInput {
    pub limit: usize,
    pub offset: usize,
}

#[hdk_extern]
pub fn get_all_songs(input: GetAllSongsInput) -> ExternResult<Vec<Song>> {
    let all_songs_path = Path::from("all_songs");
    let links = get_links(
        GetLinksInputBuilder::try_new(all_songs_path.path_entry_hash()?, LinkTypes::AllSongs)?
            .build(),
    )?;

    let mut songs = Vec::new();
    for link in links.into_iter().skip(input.offset).take(input.limit) {
        if let Some(action_hash) = link.target.into_action_hash() {
            if let Some(song) = get_song(action_hash)? {
                songs.push(song);
            }
        }
    }
    Ok(songs)
}

/// Get songs by genre
#[hdk_extern]
pub fn get_songs_by_genre(genre: String) -> ExternResult<Vec<Song>> {
    let genre_path = Path::from(format!("genres/{}", genre.to_lowercase()));
    let links = get_links(
        GetLinksInputBuilder::try_new(genre_path.path_entry_hash()?, LinkTypes::GenreToSongs)?
            .build(),
    )?;

    let mut songs = Vec::new();
    for link in links {
        if let Some(action_hash) = link.target.into_action_hash() {
            if let Some(song) = get_song(action_hash)? {
                songs.push(song);
            }
        }
    }
    Ok(songs)
}

/// Create an album
#[hdk_extern]
pub fn create_album(album: Album) -> ExternResult<ActionHash> {
    let action_hash = create_entry(&EntryTypes::Album(album.clone()))?;

    // Link from artist to album
    let artist_path = Path::from(format!("artists/{}", album.artist));
    artist_path.ensure()?;
    create_link(
        artist_path.path_entry_hash()?,
        action_hash.clone(),
        LinkTypes::ArtistToAlbums,
        (),
    )?;

    // Link album to its songs
    for song_hash in &album.song_hashes {
        create_link(
            action_hash.clone(),
            song_hash.clone(),
            LinkTypes::AlbumToSongs,
            (),
        )?;
    }

    Ok(action_hash)
}

/// Get an album with its songs
#[derive(Serialize, Deserialize, Debug)]
pub struct AlbumWithSongs {
    pub album: Album,
    pub songs: Vec<Song>,
}

#[hdk_extern]
pub fn get_album_with_songs(action_hash: ActionHash) -> ExternResult<Option<AlbumWithSongs>> {
    let record = get(action_hash.clone(), GetOptions::default())?;
    let album: Option<Album> = match record {
        Some(r) => r.entry().to_app_option().map_err(|e| wasm_error!(e))?,
        None => return Ok(None),
    };

    let album = match album {
        Some(a) => a,
        None => return Ok(None),
    };

    // Get linked songs
    let links = get_links(
        GetLinksInputBuilder::try_new(action_hash, LinkTypes::AlbumToSongs)?.build(),
    )?;

    let mut songs = Vec::new();
    for link in links {
        if let Some(song_hash) = link.target.into_action_hash() {
            if let Some(song) = get_song(song_hash)? {
                songs.push(song);
            }
        }
    }

    Ok(Some(AlbumWithSongs { album, songs }))
}

/// Create or update artist profile
#[hdk_extern]
pub fn set_artist_profile(profile: ArtistProfile) -> ExternResult<ActionHash> {
    let my_agent = agent_info()?.agent_initial_pubkey;
    let profile_path = Path::from(format!("profile/{}", my_agent));

    // Check if profile already exists
    let existing_links = get_links(
        GetLinksInputBuilder::try_new(profile_path.path_entry_hash()?, LinkTypes::AllArtists)?
            .build(),
    )?;

    if let Some(link) = existing_links.first() {
        if let Some(action_hash) = link.target.clone().into_action_hash() {
            // Update existing profile
            let updated_hash = update_entry(action_hash, &EntryTypes::ArtistProfile(profile))?;
            return Ok(updated_hash);
        }
    }

    // Create new profile
    let action_hash = create_entry(&EntryTypes::ArtistProfile(profile))?;

    // Link from profile path
    profile_path.ensure()?;
    create_link(
        profile_path.path_entry_hash()?,
        action_hash.clone(),
        LinkTypes::AllArtists,
        (),
    )?;

    // Link to all artists
    let all_artists_path = Path::from("all_artists");
    all_artists_path.ensure()?;
    create_link(
        all_artists_path.path_entry_hash()?,
        action_hash.clone(),
        LinkTypes::AllArtists,
        (),
    )?;

    Ok(action_hash)
}

/// Get artist profile by agent pub key
#[hdk_extern]
pub fn get_artist_profile(agent: AgentPubKey) -> ExternResult<Option<ArtistProfile>> {
    let profile_path = Path::from(format!("profile/{}", agent));
    let links = get_links(
        GetLinksInputBuilder::try_new(profile_path.path_entry_hash()?, LinkTypes::AllArtists)?
            .build(),
    )?;

    if let Some(link) = links.first() {
        if let Some(action_hash) = link.target.clone().into_action_hash() {
            let record = get(action_hash, GetOptions::default())?;
            return match record {
                Some(r) => Ok(r.entry().to_app_option().map_err(|e| wasm_error!(e))?),
                None => Ok(None),
            };
        }
    }

    Ok(None)
}

/// Get my profile
#[hdk_extern]
pub fn get_my_profile(_: ()) -> ExternResult<Option<ArtistProfile>> {
    let my_agent = agent_info()?.agent_initial_pubkey;
    get_artist_profile(my_agent)
}

/// Search songs by title (basic implementation)
#[hdk_extern]
pub fn search_songs(query: String) -> ExternResult<Vec<Song>> {
    let all_songs_path = Path::from("all_songs");
    let links = get_links(
        GetLinksInputBuilder::try_new(all_songs_path.path_entry_hash()?, LinkTypes::AllSongs)?
            .build(),
    )?;

    let query_lower = query.to_lowercase();
    let mut matches = Vec::new();

    for link in links {
        if let Some(action_hash) = link.target.into_action_hash() {
            if let Some(song) = get_song(action_hash)? {
                if song.title.to_lowercase().contains(&query_lower) {
                    matches.push(song);
                }
            }
        }
    }

    Ok(matches)
}
